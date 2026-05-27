import csv
import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from marketplace_utils import product_stock_quantity
from models import Complaint, Message, Order, OrderItem, Product, Transaction, User, Wallet
from order_statuses import ORDER_STATUS_LABELS, normalize_order_status
from routes.conversations import upsert_finance_conversation


router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/")
def accounting_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner), joinedload(Order.user))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(100)
        .all()
    )
    transactions = db.query(Transaction).order_by(Transaction.created_at.desc(), Transaction.id.desc()).limit(200).all()
    financial_requests = (
        db.query(Complaint)
        .options(joinedload(Complaint.author), joinedload(Complaint.order))
        .filter(Complaint.category == "payment", Complaint.status == "sent_to_accountant", Complaint.assigned_to_role == "accountant")
        .order_by(Complaint.updated_at.desc(), Complaint.created_at.desc())
        .limit(100)
        .all()
    )
    return request.app.state.templates.TemplateResponse(
        request,
        "accounting",
        {
            "user": user,
            "orders": orders,
            "transactions": transactions,
            "payments": [t for t in transactions if t.type == "payment"],
            "refunds": [t for t in transactions if t.type == "refund"],
            "financial_requests": financial_requests,
            "status_labels": ORDER_STATUS_LABELS,
            "accounting_success": request.session.pop("accounting_success", None),
            "accounting_error": request.session.pop("accounting_error", None),
        },
    )


@router.get("/orders/{order_id}")
def accounting_order_detail(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.user),
            joinedload(Order.delivery),
            joinedload(Order.coupon),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        request.session["accounting_error"] = "Заказ не найден."
        return RedirectResponse("/accounting/", status_code=303)

    return request.app.state.templates.TemplateResponse(
        request,
        "accounting_order",
        {
            "user": user,
            "order": order,
            "status_labels": ORDER_STATUS_LABELS,
        },
    )


@router.get("/requests/{complaint_id}")
def accounting_request_detail(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    complaint = db.query(Complaint).options(joinedload(Complaint.author), joinedload(Complaint.order)).filter(
        Complaint.id == complaint_id,
        Complaint.category == "payment",
        Complaint.status == "sent_to_accountant",
        Complaint.assigned_to_role == "accountant",
    ).first()
    if not complaint:
        request.session["accounting_error"] = "Обращение не найдено."
        return RedirectResponse("/accounting/", status_code=303)

    conversation = upsert_finance_conversation(db, complaint)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    order = db.query(Order).filter(Order.id == complaint.order_id).first() if complaint.order_id else None
    return request.app.state.templates.TemplateResponse(
        request,
        "accounting_request",
        {
            "user": user,
            "complaint": complaint,
            "conversation": conversation,
            "messages": messages,
            "order": order,
            "accounting_success": request.session.pop("accounting_success", None),
            "accounting_error": request.session.pop("accounting_error", None),
        },
    )


@router.post("/orders/{order_id}/payout")
def confirm_payout(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        request.session["accounting_error"] = "Заказ не найден."
        return RedirectResponse("/accounting/", status_code=303)
    order.payout_status = "transferred_to_partner"
    order.payout_confirmed_at = datetime.utcnow()
    if order.escrow_status == "pending":
        order.escrow_status = "released"
    db.commit()
    request.session["accounting_success"] = "Выплата подтверждена, заказ передан партнеру."
    return RedirectResponse("/accounting/", status_code=303)


@router.post("/requests/{complaint_id}/comment")
def accounting_request_comment(
    complaint_id: int,
    request: Request,
    text: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    complaint = db.query(Complaint).options(joinedload(Complaint.order)).filter(
        Complaint.id == complaint_id,
        Complaint.category == "payment",
        Complaint.status == "sent_to_accountant",
        Complaint.assigned_to_role == "accountant",
    ).first()
    if not complaint:
        return RedirectResponse("/accounting/", status_code=303)

    conversation = upsert_finance_conversation(db, complaint)
    text = (text or "").strip()
    if text:
        db.add(Message(
            conversation_id=conversation.id,
            sender_id=user.id,
            sender_role=user.role,
            text=text[:2000],
        ))
        db.commit()
    request.session["accounting_success"] = "Комментарий добавлен."
    return RedirectResponse(f"/accounting/requests/{complaint.id}", status_code=303)


@router.post("/orders/{order_id}/refund")
def initiate_refund(
    order_id: int,
    request: Request,
    reason: str = Form("Возврат инициирован бухгалтером"),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order or order.payment_status != "paid":
        request.session["accounting_error"] = "Возврат по этому заказу недоступен."
        return RedirectResponse("/accounting/", status_code=303)

    previous_status = normalize_order_status(order.status)
    if previous_status in ("cancelled", "refunded"):
        request.session["accounting_error"] = "\u0412\u043e\u0437\u0432\u0440\u0430\u0442 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u0437\u0430\u043a\u0430\u0437\u0443 \u0443\u0436\u0435 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u043d."
        return RedirectResponse("/accounting/", status_code=303)

    buyer = db.query(User).filter(User.id == order.user_id).first()
    if not buyer:
        request.session["accounting_error"] = "Покупатель не найден."
        return RedirectResponse("/accounting/", status_code=303)

    wallet = db.query(Wallet).filter(Wallet.user_id == buyer.id).first()
    if not wallet:
        wallet = Wallet(user_id=buyer.id, balance=0)
        db.add(wallet)
        db.flush()

    amount = Decimal(order.total_price or 0)
    wallet.balance = Decimal(wallet.balance or 0) + amount
    db.add(Transaction(
        user_id=buyer.id,
        wallet_id=wallet.id,
        order_id=order.id,
        amount=amount,
        type="refund",
        status="completed",
        payment_method="wallet",
        description=reason[:500],
    ))
    if previous_status not in ("cancelled", "refunded"):
        for item in order.items or []:
            if item.product and item.quantity:
                item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)

    order.status = "refunded"
    order.return_status = "approved"
    order.return_reason = reason[:2000]
    order.escrow_status = "refunded"
    db.commit()
    request.session["accounting_success"] = "Возврат инициирован."
    return RedirectResponse("/accounting/", status_code=303)


@router.get("/commissions.csv")
def commissions_report(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["accountant"])
    if guard:
        return guard

    orders = db.query(Order).order_by(Order.created_at.desc(), Order.id.desc()).limit(5000).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["order_number", "created_at", "total_price", "platform_fee", "payout_status"])
    for order in orders:
        writer.writerow([
            order.order_number or order.id,
            order.created_at.isoformat() if order.created_at else "",
            float(order.total_price or 0),
            float(order.platform_fee or 0),
            order.payout_status or "pending",
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="commissions_report.csv"'},
    )
