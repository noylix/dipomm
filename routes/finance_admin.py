# routes/finance_admin.py — финансы для администратора платформы

from decimal import Decimal

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from finance_ledger import admin_resolve_withdrawal, create_payment_dispute, get_platform_wallet
from datetime import datetime

from models import Order, PaymentDispute, User, WithdrawalRequest
from payment_refunds import refund_order_payment
from order_cancellation import restore_order_stock

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])


def admin_finance_context(db: Session, request: Request, user: User) -> dict:
    withdrawals = (
        db.query(WithdrawalRequest)
        .options(joinedload(WithdrawalRequest.seller))
        .order_by(WithdrawalRequest.created_at.desc(), WithdrawalRequest.id.desc())
        .limit(100)
        .all()
    )
    paid_orders = (
        db.query(Order)
        .options(joinedload(Order.user))
        .filter(Order.payment_status == "paid")
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(80)
        .all()
    )
    disputes = (
        db.query(PaymentDispute)
        .order_by(PaymentDispute.created_at.desc(), PaymentDispute.id.desc())
        .limit(50)
        .all()
    )
    platform = get_platform_wallet(db)
    db.commit()
    return {
        "withdrawals": withdrawals,
        "paid_orders": paid_orders,
        "disputes": disputes,
        "platform_wallet": platform,
        "finance_success": request.session.pop("finance_success", None),
        "finance_error": request.session.pop("finance_error", None),
    }


@router.get("/")
def admin_finance_page(request: Request, db: Session = Depends(get_db)):
    """Финансы встроены в единую панель управления."""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard
    return RedirectResponse("/admin/manage?tab=finance", status_code=303)


@router.post("/withdrawals/{request_id}/approve")
def approve_withdrawal(request_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard
    comment = (request.query_params.get("comment") or "").strip()
    ok, msg = admin_resolve_withdrawal(db, request_id, user, approve=True, comment=comment)
    if ok:
        db.commit()
        request.session["finance_success"] = msg
    else:
        request.session["finance_error"] = msg
    return RedirectResponse("/admin/manage?tab=finance", status_code=303)


@router.post("/withdrawals/{request_id}/reject")
def reject_withdrawal(
    request_id: int,
    request: Request,
    comment: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard
    ok, msg = admin_resolve_withdrawal(db, request_id, user, approve=False, comment=comment)
    if ok:
        db.commit()
        request.session["finance_success"] = msg
    else:
        request.session["finance_error"] = msg
    return RedirectResponse("/admin/manage?tab=finance", status_code=303)


@router.post("/refunds")
def admin_create_refund(
    request: Request,
    order_id: int = Form(...),
    amount: str = Form(""),
    reason: str = Form("Возврат администратором"),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.payment_status != "paid":
        request.session["finance_error"] = "Возврат недоступен для этого заказа."
        return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    refund_amount = Decimal(order.payment_amount or order.total_price or 0)
    if str(amount).strip():
        try:
            refund_amount = Decimal(str(amount).replace(",", "."))
        except Exception:
            request.session["finance_error"] = "Некорректная сумма возврата."
            return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    if (order.escrow_status or "pending") == "released":
        dispute = PaymentDispute(
            order_id=order.id,
            seller_id=None,
            buyer_id=order.user_id,
            amount=refund_amount,
            status="open",
            resolution_note=(reason or "")[:2000],
            admin_id=user.id,
        )
        for item in order.items or []:
            if item.product and item.product.owner_id:
                dispute.seller_id = item.product.owner_id
                break
        db.add(dispute)
        db.commit()
        request.session["finance_error"] = (
            "Фермеру уже начислены средства. Создан спор — решите вручную (возврат покупателю / удержание)."
        )
        return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    from payment_refunds import refund_order_payment_amount

    ok, message, refunded = refund_order_payment_amount(db, order, refund_amount, reason[:500])
    if not ok:
        request.session["finance_error"] = message
        return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    if refunded:
        restore_order_stock(order)
        order.status = "refunded"
        order.escrow_status = "refunded"
    db.commit()
    request.session["finance_success"] = message or "Возврат оформлен."
    return RedirectResponse("/admin/manage?tab=finance", status_code=303)


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: int,
    request: Request,
    resolution: str = Form(...),
    note: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    dispute = db.query(PaymentDispute).filter(PaymentDispute.id == dispute_id).first()
    if not dispute or dispute.status != "open":
        request.session["finance_error"] = "Спор не найден."
        return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    order = db.query(Order).filter(Order.id == dispute.order_id).first()
    if not order:
        request.session["finance_error"] = "Заказ не найден."
        return RedirectResponse("/admin/manage?tab=finance", status_code=303)

    if resolution == "refund_buyer":
        ok, msg, _ = refund_order_payment(db, order, note or f"Спор #{dispute.id}")
        if not ok:
            request.session["finance_error"] = msg
            return RedirectResponse("/admin/manage?tab=finance", status_code=303)
        dispute.status = "resolved_buyer"
        order.escrow_status = "refunded"
    elif resolution == "keep_seller":
        from finance_ledger import release_escrow_for_order

        if (order.escrow_status or "") == "pending":
            release_escrow_for_order(db, order, trigger="dispute")
        dispute.status = "resolved_seller"
    else:
        dispute.status = "closed"

    dispute.resolution_note = (note or dispute.resolution_note or "")[:2000]
    dispute.resolved_at = datetime.utcnow()
    dispute.admin_id = user.id
    db.commit()
    request.session["finance_success"] = "Спор закрыт."
    return RedirectResponse("/admin/manage?tab=finance", status_code=303)
