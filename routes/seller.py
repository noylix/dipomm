import os
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from logistics import ensure_logistics_shipment, mark_shipment_in_transit
from marketplace_utils import effective_product_price, normalize_product_unit, product_stock_quantity
from coupon_utils import (
    COUPON_CODE_RE,
    normalize_coupon_code,
    parse_coupon_date_end,
    parse_coupon_date_start,
    serialize_coupon,
)
from models import Complaint, Conversation, Coupon, FarmCertificate, Notification, Order, OrderItem, Product, ProductImage, SellerReview, User
from order_cancellation import cancel_order
from order_item_exclusion import exclude_order_item
from order_statuses import ORDER_STATUS_LABELS, normalize_order_status, order_counts_toward_revenue
from phone_utils import format_ru_phone, is_valid_ru_phone
from routes.conversations import _save_attachment, upsert_support_conversation

UPLOAD_DIR = os.path.join("static", "uploads", "products")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_PRODUCT_IMAGES = 10
FARM_UPLOAD_DIR = os.path.join("static", "uploads", "farms")
os.makedirs(FARM_UPLOAD_DIR, exist_ok=True)
CERT_UPLOAD_DIR = FARM_UPLOAD_DIR
ALLOWED_FARM_EXT = ALLOWED_IMAGE_EXT


def _read_with_limit(upload: UploadFile, limit: int) -> bytes | None:
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        return None
    return data

router = APIRouter(prefix="/seller", tags=["seller"])

SELLER_STATUS_TRANSITIONS = {
    "confirm": "confirmed",
    "assemble": "assembling",
    "ready_pickup": "ready_for_pickup",
    "ready_delivery": "ready_for_delivery",
    "transfer_partner": "ready_for_delivery",
    "in_delivery": "in_delivery",
    "delivered": "delivered",
    "cancel": "cancelled",
}

SELLER_NOTIFICATION_TEMPLATES = {
    "confirmed": (
        "Заказ подтвержден",
        "Продавец подтвердил заказ #{order_id}. Можно готовиться к получению.",
    ),
    "assembling": (
        "Заказ собирается",
        "Продавец начал собирать заказ #{order_id}.",
    ),
    "shipped": (
        "Заказ передан в доставку",
        "Заказ #{order_id} передан в доставку.",
    ),
    "delivering": (
        "Заказ в пути",
        "Заказ #{order_id} уже доставляется.",
    ),
    "canceled": (
        "Заказ отменен",
        "Продавец отменил заказ #{order_id}. {reason}",
    ),
}


def _clean_product_payload(
    name: str,
    price: float,
    discount_price: float | None,
    category: str,
    expiration_days: int,
    stock: int,
    unit: str = "\u0448\u0442",
    low_stock_threshold: int = 0,
    description: str = "",
) -> tuple[bool, str]:
    if not name or not name.strip():
        return False, "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e."
    if price <= 0:
        return False, "\u0426\u0435\u043d\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0."
    if expiration_days < 0:
        return False, "\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u043c."
    if stock < 0:
        return False, "\u041e\u0441\u0442\u0430\u0442\u043e\u043a \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u043c."
    if low_stock_threshold < 0:
        return False, "\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u043e\u0441\u0442\u0430\u0442\u043e\u043a \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u043c."
    if not (unit or "").strip() or len((unit or "").strip()) > 50:
        return False, "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0435\u0434\u0438\u043d\u0438\u0446\u0443 \u0438\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u044f."
    if len(name.strip()) > 255 or len((category or "").strip()) > 100:
        return False, "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435 \u0438\u043c\u044f \u0438\u043b\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f."
    if len(description or "") > 4000:
        return False, "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435."
    if discount_price is not None and discount_price > 0 and discount_price > price:
        return False, "\u0426\u0435\u043d\u0430 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0432\u044b\u0448\u0435 \u043e\u0431\u044b\u0447\u043d\u043e\u0439."
    return True, ""


def _save_product_images(uploads: list[UploadFile] | None) -> list[str]:
    urls: list[str] = []
    for upload in uploads or []:
        if len(urls) >= MAX_PRODUCT_IMAGES:
            break
        if not upload or not upload.filename:
            continue
        saved = _save_product_image(upload)
        if saved and saved not in urls:
            urls.append(saved)
    return urls


def _sync_product_gallery(product: Product, urls: list[str], db: Session) -> None:
    clean_urls: list[str] = []
    seen: set[str] = set()
    for url in urls:
        value = (url or "").strip()
        if value and value not in seen:
            seen.add(value)
            clean_urls.append(value)
    clean_urls = clean_urls[:MAX_PRODUCT_IMAGES]
    db.query(ProductImage).filter(ProductImage.product_id == product.id).delete()
    for index, url in enumerate(clean_urls):
        db.add(ProductImage(product_id=product.id, image_url=url, sort_order=index))
    product.image_url = clean_urls[0] if clean_urls else None


def _save_product_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        return None
    data = _read_with_limit(upload, MAX_IMAGE_BYTES)
    if data is None or not data:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(data)
    return f"/static/uploads/products/{filename}"


def _save_farm_photo(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_FARM_EXT:
        return None
    data = _read_with_limit(upload, MAX_IMAGE_BYTES)
    if data is None or not data:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(FARM_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(data)
    return f"/static/uploads/farms/{filename}"


def _save_certificate_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_FARM_EXT:
        return None
    data = _read_with_limit(upload, MAX_IMAGE_BYTES)
    if data is None or not data:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(CERT_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(data)
    return f"/static/uploads/farms/{filename}"



def _restore_order_stock(order: Order) -> None:
    for item in order.items or []:
        if item.product and item.quantity:
            item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)


def _seller_money_breakdown(order: Order, seller_id: int) -> tuple[Decimal, Decimal, Decimal]:
    seller_goods_total = Decimal("0")
    order_goods_total = Decimal("0")

    for item in order.items or []:
        if not item.product:
            continue
        item_total = Decimal(effective_product_price(item.product)) * Decimal(int(item.quantity or 0))
        order_goods_total += item_total
        if item.product.owner_id == seller_id:
            seller_goods_total += item_total

    if seller_goods_total <= 0:
        return Decimal("0"), Decimal("0"), Decimal("0")

    platform_fee = Decimal(order.platform_fee or 0)
    seller_fee = Decimal("0")
    if order_goods_total > 0 and platform_fee > 0:
        seller_fee = (platform_fee * seller_goods_total / order_goods_total).quantize(Decimal("0.01"))
    seller_net = (seller_goods_total - seller_fee).quantize(Decimal("0.01"))
    return seller_goods_total.quantize(Decimal("0.01")), seller_fee, seller_net


def _build_seller_financials(seller_id: int, db: Session) -> dict[str, float | int]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .filter(Product.owner_id == seller_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .distinct()
        .all()
    )

    paid_orders_count = 0
    gross_revenue = Decimal("0")
    platform_fee = Decimal("0")
    pending_payout = Decimal("0")

    for order in orders:
        if not order_counts_toward_revenue(order.status, order.payment_status):
            continue

        seller_goods_total, seller_fee, seller_net = _seller_money_breakdown(order, seller_id)
        if seller_goods_total <= 0:
            continue

        paid_orders_count += 1
        gross_revenue += seller_goods_total
        platform_fee += seller_fee

        if (order.escrow_status or "pending") == "pending":
            pending_payout += seller_net

    from finance_ledger import wallet_summary

    summary = wallet_summary(db, seller_id)
    return {
        "paid_orders_count": paid_orders_count,
        "gross_revenue": round(float(gross_revenue), 2),
        "platform_fee": round(float(platform_fee), 2),
        "pending_payout": round(float(pending_payout), 2),
        "available_balance": summary["available_balance"],
        "balance": summary["balance"],
    }


def _seller_is_approved(user: User | None) -> bool:
    return bool(user and user.role == "seller" and user.seller_application_status == "approved")


def _seller_dashboard_context(user: User, db: Session, request: Request, initial_tab: str = "overview") -> dict[str, object]:
    if user.role == "admin":
        products = db.query(Product).all()
        financials = None
        certificates = []
        promo_codes = []
    else:
        products = db.query(Product).filter(Product.owner_id == user.id).all()
        financials = _build_seller_financials(user.id, db)
        certificates = (
            db.query(FarmCertificate)
            .filter(FarmCertificate.seller_id == user.id)
            .order_by(FarmCertificate.id.desc())
            .all()
        )
        promo_codes = [
            serialize_coupon(coupon)
            for coupon in db.query(Coupon)
            .filter(Coupon.seller_id == user.id)
            .order_by(Coupon.id.desc())
            .all()
        ]
    conversations = (
        db.query(Conversation)
        .filter(Conversation.farmer_id == user.id)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        .limit(50)
        .all()
    )
    support_requests = (
        db.query(Complaint)
        .filter(Complaint.user_id == user.id)
        .order_by(Complaint.created_at.desc())
        .limit(50)
        .all()
    )
    support_conversations = {
        conversation.complaint_id: conversation.id
        for conversation in db.query(Conversation).filter(Conversation.type == "support_request", Conversation.buyer_id == user.id).all()
    }
    support_items = [
        {
            "ticket": ticket,
            "conversation_id": support_conversations.get(ticket.id),
        }
        for ticket in support_requests
    ]
    from finance_ledger import get_seller_wallet, wallet_summary
    from models import LedgerEntry

    wallet = get_seller_wallet(db, user.id)
    ledger_limit = 500 if initial_tab == "history" else 5
    ledger_query = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.wallet_id == wallet.id)
        .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
    )
    type_filter = (request.query_params.get("type_filter") or "").strip() if initial_tab == "history" else ""
    date_from = (request.query_params.get("date_from") or "").strip() if initial_tab == "history" else ""
    date_to = (request.query_params.get("date_to") or "").strip() if initial_tab == "history" else ""
    if type_filter in ("credit", "debit"):
        ledger_query = ledger_query.filter(LedgerEntry.direction == type_filter)
    if date_from:
        try:
            from datetime import datetime

            ledger_query = ledger_query.filter(
                LedgerEntry.created_at >= datetime.strptime(date_from, "%Y-%m-%d")
            )
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import datetime

            end = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            ledger_query = ledger_query.filter(LedgerEntry.created_at <= end)
        except ValueError:
            pass
    ledger_entries = ledger_query.limit(ledger_limit).all()

    return {
        "seller": user,
        "products": products,
        "user": user,
        "financials": financials,
        "wallet": wallet,
        "wallet_summary": wallet_summary(db, user.id),
        "ledger_entries": ledger_entries,
        "type_filter": type_filter,
        "date_from": date_from,
        "date_to": date_to,
        "wallet_success": request.session.pop("wallet_success", None),
        "wallet_error": request.session.pop("wallet_error", None),
        "certificates": certificates,
        "promo_codes": promo_codes,
        "conversations": conversations,
        "support_requests": support_items,
        "initial_tab": initial_tab,
        "seller_error": request.session.pop("seller_error", None),
        "seller_success": request.session.pop("seller_success", None),
    }


@router.get("/pending")
def seller_pending(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if not user or user.role != "seller":
        return RedirectResponse("/", status_code=303)
    if _seller_is_approved(user):
        return RedirectResponse("/seller/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request,
        "seller_pending",
        {
            "user": user,
            "application_status": user.seller_application_status or "pending",
            "application_number": user.seller_application_number,
            "application_rejection_reason": user.seller_application_rejection_reason,
            "notice_message": request.session.pop("seller_pending_notice", None),
        },
    )


@router.get("/")
def seller_panel(request: Request, tab: str = "", db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    initial_tab = tab or request.query_params.get("tab") or "overview"
    ctx = _seller_dashboard_context(user, db, request, initial_tab=initial_tab)
    db.commit()
    return request.app.state.templates.TemplateResponse(request, "seller", ctx)


@router.get("/support")
def seller_support_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    tickets = (
        db.query(Complaint)
        .filter(Complaint.user_id == user.id)
        .order_by(Complaint.created_at.desc())
        .limit(100)
        .all()
    )
    support_conversations = {
        conversation.complaint_id: conversation.id
        for conversation in db.query(Conversation).filter(Conversation.type == "support_request", Conversation.buyer_id == user.id).all()
    }
    ticket_items = [
        {
            "ticket": ticket,
            "conversation_id": support_conversations.get(ticket.id),
        }
        for ticket in tickets
    ]
    return request.app.state.templates.TemplateResponse(
        request,
        "seller_support",
        {
            "seller": user,
            "user": user,
            "tickets": ticket_items,
            "seller_error": request.session.pop("seller_error", None),
            "seller_success": request.session.pop("seller_success", None),
        },
    )


@router.post("/support/create")
def seller_support_create(
    request: Request,
    topic: str = Form("other"),
    text: str = Form(""),
    attachment: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    topic = (topic or "other").strip()
    text = (text or "").strip()
    if topic not in ("moderation", "documents", "certificates", "block", "commission", "other") or len(text) < 10:
        request.session["seller_error"] = "Заполните тему и текст обращения."
        return RedirectResponse("/seller/support", status_code=303)

    complaint = Complaint(
        user_id=user.id,
        category=topic,
        type=topic,
        text=text[:2000],
        attachment_path=_save_attachment(attachment),
        status="new",
        assigned_to_role="admin",
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    upsert_support_conversation(db, complaint)
    request.session["seller_success"] = "Обращение создано."
    return RedirectResponse("/seller/support", status_code=303)


@router.get("/settings")
def seller_settings_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    return request.app.state.templates.TemplateResponse(
        request,
        "seller",
        _seller_dashboard_context(user, db, request, initial_tab=request.query_params.get("tab") or "profile"),
    )


@router.get("/orders")
def seller_orders(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    query = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.user),
            joinedload(Order.delivery),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
    )
    if user.role == "admin":
        orders = query.order_by(Order.created_at.desc(), Order.id.desc()).distinct().all()
    else:
        orders = (
            query
            .filter(Product.owner_id == user.id)
            .order_by(Order.created_at.desc(), Order.id.desc())
            .distinct()
            .all()
        )

    seller_orders_payload = []
    for order in orders:
        seller_items = []
        seller_total = 0.0
        for item in order.items or []:
            if not item.product:
                continue
            if user.role != "admin" and item.product.owner_id != user.id:
                continue
            item_total = float(effective_product_price(item.product)) * int(item.quantity or 0)
            seller_total += item_total
            seller_items.append({
                "id": item.id,
                "quantity": item.quantity,
                "item_total": round(item_total, 2),
                "product": item.product,
            })
        if not seller_items:
            continue
        from finance_ledger import order_settlement_payload

        settlement = order_settlement_payload(order, user.id, db) if user.role == "seller" else {}
        seller_orders_payload.append({
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "payment_status": order.payment_status,
            "created_at": order.created_at,
            "customer_name": order.customer_name or (order.user.full_name if order.user else None) or (order.user.email if order.user else None),
            "customer_phone": order.customer_phone,
            "delivery_address": order.delivery_address or (order.delivery.address if order.delivery else None),
            "delivery_method": order.delivery_method or (order.delivery.method if order.delivery else None),
            "delivery_slot": order.delivery_slot,
            "delivery_provider": order.delivery.provider if order.delivery else None,
            "delivery_track_number": order.delivery.track_number if order.delivery else None,
            "delivery_tracking_url": order.delivery.tracking_url if order.delivery else None,
            "delivery_status": order.delivery.status if order.delivery else None,
            "customer_comment": order.customer_comment,
            "selected_payment_method": order.selected_payment_method,
            "seller_cancel_reason": order.seller_cancel_reason,
            "seller_total": round(seller_total, 2),
            "total_price": float(order.total_price or 0),
            "discount_amount": float(order.discount_amount or 0),
            "delivery_fee": float(order.delivery_fee or 0),
            "items": seller_items,
            "settlement": settlement,
        })

    return request.app.state.templates.TemplateResponse(
        request,
        "seller_orders",
        {
            "user": user,
            "orders": seller_orders_payload,
            "status_labels": ORDER_STATUS_LABELS,
            "seller_order_success": request.session.pop("seller_order_success", None),
            "seller_order_error": request.session.pop("seller_order_error", None),
        },
    )


@router.post("/orders/{order_id}/status")
def seller_change_order_status(
    order_id: int,
    request: Request,
    action: str = Form(...),
    cancel_reason: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    next_status = SELLER_STATUS_TRANSITIONS.get(action)
    if not next_status:
        request.session["seller_order_error"] = "Неизвестное действие со статусом."
        return RedirectResponse("/seller/orders", status_code=303)

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        request.session["seller_order_error"] = "Заказ не найден."
        return RedirectResponse("/seller/orders", status_code=303)

    seller_items = [
        item for item in (order.items or [])
        if item.product and item.product.owner_id == user.id
    ]
    has_other_seller_items = any(
        item.product and item.product.owner_id != user.id
        for item in (order.items or [])
    )
    if user.role != "admin" and not seller_items:
        request.session["seller_order_error"] = "У вас нет доступа к этому заказу."
        return RedirectResponse("/seller/orders", status_code=303)

    if user.role != "admin" and has_other_seller_items:
        request.session["seller_order_error"] = "Заказ содержит товары других продавцов. Статус нужно менять через администратора."
        return RedirectResponse("/seller/orders", status_code=303)

    current_status = normalize_order_status(order.status)
    method = order.delivery_method or (order.delivery.method if order.delivery else "pickup")
    ready_action = "ready_pickup" if method == "pickup" else ("transfer_partner" if method == "partner_delivery" else "ready_delivery")
    allowed_actions = {
        "awaiting_payment": {"cancel"},
        "created": {"cancel"},
        "paid": {"confirm", "assemble", "cancel"},
        "confirmed": {"assemble", "cancel"},
        "assembling": {ready_action, "cancel"},
        "ready_for_pickup": {"delivered"},
        "ready_for_delivery": {"in_delivery", "delivered"} if method == "farmer_delivery" else {"in_delivery"},
        "in_delivery": {"delivered"},
        "delivered": set(),
        "received": set(),
        "completed": set(),
        "cancelled": set(),
        "refunded": set(),
    }
    if action not in allowed_actions.get(current_status, set()):
        request.session["seller_order_error"] = "Для этого заказа сейчас недоступно выбранное действие."
        return RedirectResponse("/seller/orders", status_code=303)

    if action != "cancel" and order.payment_status != "paid":
        request.session["seller_order_error"] = "Заказ еще не оплачен. Дождитесь подтверждения оплаты."
        return RedirectResponse("/seller/orders", status_code=303)

    cancel_reason = (cancel_reason or "").strip()
    if action == "cancel":
        ok, message = cancel_order(db, order, role="seller", reason=cancel_reason)
        if not ok:
            request.session["seller_order_error"] = message
            return RedirectResponse("/seller/orders", status_code=303)
        db.commit()
        return RedirectResponse(f"/seller/orders#order-{order_id}", status_code=303)

    order.status = next_status
    order.seller_cancel_reason = None

    delivery = order.delivery
    if delivery:
        if next_status == "confirmed":
            delivery.status = "waiting_assembly"
        elif next_status == "ready_for_pickup":
            delivery.status = "ready_for_pickup"
        elif next_status == "ready_for_delivery" and method == "partner_delivery":
            delivery.status = "transferred_to_delivery"
        elif next_status == "ready_for_delivery":
            delivery.status = "ready_for_delivery"
        elif next_status == "in_delivery":
            delivery.status = "in_transit"
        elif next_status == "delivered":
            delivery.status = "delivered"
            from finance_ledger import mark_order_delivered

            mark_order_delivered(db, order)

    subject_template, body_template = SELLER_NOTIFICATION_TEMPLATES.get(
        next_status,
        (
            f"Статус заказа #{order.id} обновлен",
            f'Продавец изменил статус заказа #{order.id} на "{ORDER_STATUS_LABELS.get(next_status, next_status)}".',
        ),
    )
    db.add(Notification(
        user_id=order.user_id,
        type="system",
        subject=subject_template.format(order_id=order.id),
        body=body_template.format(
            order_id=order.id,
            reason=(f"Причина: {cancel_reason}" if cancel_reason else ""),
        ),
    ))
    db.commit()

    request.session["seller_order_success"] = (
        f'Заказ #{order.id}: статус "{ORDER_STATUS_LABELS.get(next_status, next_status)}".'
    )
    if delivery and delivery.track_number:
        request.session["seller_order_success"] += f" Track: {delivery.track_number}."
    return RedirectResponse("/seller/orders", status_code=303)


@router.post("/orders/{order_id}/items/{item_id}/exclude")
def seller_exclude_order_item(
    order_id: int,
    item_id: int,
    request: Request,
    exclusion_reason: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        request.session["seller_order_error"] = "Заказ не найден."
        return RedirectResponse("/seller/orders", status_code=303)

    item = next((row for row in (order.items or []) if row.id == item_id), None)
    if not item:
        request.session["seller_order_error"] = "Позиция заказа не найдена."
        return RedirectResponse(f"/seller/orders#order-{order_id}", status_code=303)

    ok, message = exclude_order_item(
        db,
        order,
        item,
        role="seller",
        reason=exclusion_reason,
        actor_user_id=user.id,
        seller_id=user.id,
    )
    if not ok:
        request.session["seller_order_error"] = message
        return RedirectResponse(f"/seller/orders#order-{order_id}", status_code=303)

    db.commit()
    request.session["seller_order_success"] = message
    return RedirectResponse(f"/seller/orders#order-{order_id}", status_code=303)


@router.post("/product/add")
def seller_add_product(
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    discount_price: str = Form(""),
    category: str = Form("Другое"),
    variety: str = Form(""),
    weight_per_unit: str = Form(""),
    expiration_days: int = Form(0),
    region: str = Form(""),
    stock: int = Form(0),
    unit: str = Form("\u0448\u0442"),
    low_stock_threshold: int = Form(0),
    description: str = Form(""),
    image: UploadFile = File(None),
    images: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    parsed_discount = None
    if str(discount_price).strip():
        try:
            parsed_discount = float(discount_price)
        except ValueError:
            request.session["seller_error"] = "\u0426\u0435\u043d\u0430 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0447\u0438\u0441\u043b\u043e\u043c."
            return RedirectResponse(url="/seller/", status_code=303)

    is_valid, error = _clean_product_payload(
        name,
        price,
        parsed_discount,
        category,
        expiration_days,
        stock,
        unit,
        low_stock_threshold,
        description,
    )
    if not is_valid:
        request.session["seller_error"] = error
        return RedirectResponse(url="/seller/", status_code=303)

    unit = normalize_product_unit(unit, category)
    gallery_urls = _save_product_images(images)
    cover_url = _save_product_image(image)
    if cover_url:
        gallery_urls = [cover_url] + [url for url in gallery_urls if url != cover_url]
    initial_status = "approved" if user.role == "admin" else "pending"
    product = Product(
        name=name,
        price=price,
        discount_price=parsed_discount,
        owner_id=user.id,
        category=category,
        variety=variety or None,
        weight_per_unit=weight_per_unit or None,
        expiration_days=expiration_days if expiration_days > 0 else None,
        has_certificate=1,
        region=region or None,
        stock=stock,
        unit=unit,
        low_stock_threshold=low_stock_threshold,
        image_url=cover_url or (gallery_urls[0] if gallery_urls else None),
        description=description or None,
        status=initial_status,
    )
    db.add(product)
    db.flush()
    if gallery_urls:
        _sync_product_gallery(product, gallery_urls, db)
    db.commit()
    return RedirectResponse(url="/seller/", status_code=303)


@router.get("/product/edit/{product_id}")
def seller_edit_product_page(product_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    product = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        return RedirectResponse(url="/seller/", status_code=303)
    if user.role == "seller" and product.owner_id != user.id:
        return RedirectResponse(url="/seller/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request,
        "seller_product_edit",
        {"product": product, "user": user},
    )


@router.post("/product/edit/{product_id}")
def seller_edit_product_submit(
    product_id: int,
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    discount_price: str = Form(""),
    category: str = Form("Другое"),
    variety: str = Form(""),
    weight_per_unit: str = Form(""),
    expiration_days: int = Form(0),
    region: str = Form(""),
    stock: int = Form(0),
    unit: str = Form("\u0448\u0442"),
    low_stock_threshold: int = Form(0),
    description: str = Form(""),
    image: UploadFile = File(None),
    images: list[UploadFile] = File(default=[]),
    keep_image: int = Form(1),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return RedirectResponse(url="/seller/", status_code=303)
    if user.role == "seller" and product.owner_id != user.id:
        return RedirectResponse(url="/seller/", status_code=303)

    parsed_discount = None
    if str(discount_price).strip():
        try:
            parsed_discount = float(discount_price)
        except ValueError:
            request.session["seller_error"] = "\u0426\u0435\u043d\u0430 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439 \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0447\u0438\u0441\u043b\u043e\u043c."
            return RedirectResponse(url=f"/seller/product/edit/{product_id}", status_code=303)

    is_valid, error = _clean_product_payload(
        name,
        price,
        parsed_discount,
        category,
        expiration_days,
        stock,
        unit,
        low_stock_threshold,
        description,
    )
    if not is_valid:
        request.session["seller_error"] = error
        return RedirectResponse(url=f"/seller/product/edit/{product_id}", status_code=303)

    unit = normalize_product_unit(unit, category)
    product.name = name
    product.price = price
    product.discount_price = parsed_discount
    product.category = category
    product.variety = variety or None
    product.weight_per_unit = weight_per_unit or None
    product.expiration_days = expiration_days if expiration_days > 0 else None
    product.has_certificate = 1
    product.region = region or None
    product.stock = stock
    product.unit = unit
    product.low_stock_threshold = low_stock_threshold
    product.description = description or None

    from marketplace_utils import product_image_urls

    gallery_urls = product_image_urls(product)
    new_gallery_urls = _save_product_images(images)
    new_image_url = _save_product_image(image)
    if new_image_url:
        gallery_urls = [new_image_url] + [url for url in gallery_urls if url != new_image_url]
    elif new_gallery_urls:
        gallery_urls = gallery_urls + [url for url in new_gallery_urls if url not in gallery_urls]
    elif not keep_image:
        gallery_urls = []
    if gallery_urls:
        _sync_product_gallery(product, gallery_urls, db)
    elif not keep_image:
        db.query(ProductImage).filter(ProductImage.product_id == product.id).delete()
        product.image_url = None

    if user.role == "seller":
        product.status = "pending"
        product.rejection_reason = None

    db.commit()
    return RedirectResponse(url="/seller/", status_code=303)


@router.post("/product/delete/{product_id}")
def seller_delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    product = db.query(Product).filter(Product.id == product_id).first()
    if product and (product.owner_id == user.id or user.role == "admin"):
        db.delete(product)
        db.commit()
    return RedirectResponse(url="/seller/", status_code=303)


@router.post("/profile/update")
def seller_update_profile(
    request: Request,
    full_name: str = Form(""),
    phone: str = Form(""),
    farm_name: str = Form(""),
    farm_address: str = Form(""),
    product_categories: str = Form(""),
    farm_description: str = Form(""),
    farm_photo: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    phone = (phone or "").strip()
    if phone and not is_valid_ru_phone(phone):
        request.session["seller_error"] = "Укажите номер телефона полностью в формате +7 (999) 999-99-99."
        return RedirectResponse("/seller/settings", status_code=303)

    user.full_name = full_name.strip() or None
    user.phone = format_ru_phone(phone) if phone else None
    user.farm_name = farm_name.strip() or None
    user.farm_address = farm_address.strip() or None
    user.product_categories = product_categories.strip() or None
    user.farm_description = farm_description.strip() or None
    user.inn = None
    farm_photo_url = _save_farm_photo(farm_photo)
    if farm_photo_url:
        user.farm_photo_url = farm_photo_url
    db.commit()
    request.session["seller_error"] = None
    request.session["seller_success"] = "\u0410\u043d\u043a\u0435\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430."
    return RedirectResponse("/seller/", status_code=303)


@router.post("/delivery/settings")
def seller_update_delivery_settings(
    request: Request,
    pickup_enabled: int = Form(0),
    pickup_address: str = Form(""),
    pickup_comment: str = Form(""),
    farmer_delivery_enabled: int = Form(0),
    farmer_delivery_fee: Decimal = Form(0),
    farmer_delivery_min_order: Decimal = Form(0),
    farmer_delivery_comment: str = Form(""),
    delivery_slots: list[str] = Form([]),
    partner_delivery_enabled: int = Form(0),
    partner_delivery_fee: Decimal = Form(0),
    partner_delivery_comment: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    if not any([pickup_enabled, farmer_delivery_enabled, partner_delivery_enabled]):
        request.session["seller_error"] = "Включите хотя бы один способ получения."
        return RedirectResponse("/seller/settings", status_code=303)

    user.pickup_enabled = 1 if pickup_enabled else 0
    user.pickup_address = pickup_address.strip()[:500] or None
    user.pickup_comment = pickup_comment.strip()[:1000] or None
    user.farmer_delivery_enabled = 1 if farmer_delivery_enabled else 0
    user.farmer_delivery_fee = max(Decimal("0"), Decimal(farmer_delivery_fee or 0))
    user.farmer_delivery_min_order = max(Decimal("0"), Decimal(farmer_delivery_min_order or 0))
    user.farmer_delivery_comment = farmer_delivery_comment.strip()[:1000] or None
    valid_slots = [slot for slot in delivery_slots if slot in {"10-14", "14-18", "18-22"}]
    user.delivery_slots = ",".join(valid_slots or ["10-14", "14-18", "18-22"])
    user.partner_delivery_enabled = 1 if partner_delivery_enabled else 0
    user.partner_delivery_fee = max(Decimal("0"), Decimal(partner_delivery_fee or 0))
    user.partner_delivery_comment = partner_delivery_comment.strip()[:1000] or None
    db.commit()
    request.session["seller_success"] = "Настройки доставки сохранены"
    return RedirectResponse("/seller/settings?tab=delivery", status_code=303)


@router.post("/profile/certificate/add")
def seller_add_certificate(
    request: Request,
    title: str = Form(""),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    title = (title or "").strip()
    if len(title) < 3:
        request.session["seller_error"] = "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u0430 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435."
        return RedirectResponse("/seller/", status_code=303)

    certificate = FarmCertificate(
        seller_id=user.id,
        title=title,
        image_url=_save_certificate_image(image),
    )
    db.add(certificate)
    db.commit()
    request.session["seller_success"] = "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d."
    return RedirectResponse("/seller/", status_code=303)


@router.post("/promo-codes/create")
def seller_promo_create(
    request: Request,
    code: str = Form(...),
    title: str = Form(""),
    discount_percent: int = Form(...),
    min_order: float = Form(0),
    valid_from: str = Form(...),
    valid_to: str = Form(...),
    max_uses: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    if user.role != "seller":
        request.session["seller_error"] = "Промокоды доступны только фермерам."
        return RedirectResponse("/seller/", status_code=303)

    normalized_code = normalize_coupon_code(code)
    if not COUPON_CODE_RE.match(normalized_code):
        request.session["seller_error"] = "Код промокода: 3–50 символов, латиница, цифры, «-» или «_»."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    parsed_from = parse_coupon_date_start(valid_from)
    parsed_to = parse_coupon_date_end(valid_to)
    if not parsed_from or not parsed_to:
        request.session["seller_error"] = "Укажите корректные даты начала и окончания действия."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)
    if parsed_to < parsed_from:
        request.session["seller_error"] = "Дата окончания не может быть раньше даты начала."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    percent = int(discount_percent or 0)
    if percent < 5 or percent > 50:
        request.session["seller_error"] = "Скидка должна быть от 5% до 50%."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    parsed_max_uses = None
    if str(max_uses).strip():
        try:
            parsed_max_uses = int(max_uses)
        except ValueError:
            request.session["seller_error"] = "Лимит использований должен быть числом."
            return RedirectResponse("/seller/?tab=promocodes", status_code=303)
        if parsed_max_uses < 1:
            request.session["seller_error"] = "Лимит использований должен быть не меньше 1."
            return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    if db.query(Coupon).filter(Coupon.code == normalized_code).first():
        request.session["seller_error"] = "Такой промокод уже существует. Выберите другой код."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    db.add(Coupon(
        seller_id=user.id,
        code=normalized_code,
        title=(title or "").strip()[:255] or None,
        discount_percent=percent,
        min_order=max(Decimal("0"), Decimal(str(min_order or 0))),
        valid_from=parsed_from,
        valid_to=parsed_to,
        is_active=1,
        max_uses=parsed_max_uses,
    ))
    db.commit()
    request.session["seller_success"] = f"Промокод {normalized_code} создан."
    return RedirectResponse("/seller/?tab=promocodes", status_code=303)


@router.post("/promo-codes/{coupon_id}/toggle")
def seller_promo_toggle(coupon_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    if user.role != "seller":
        request.session["seller_error"] = "Промокоды доступны только фермерам."
        return RedirectResponse("/seller/", status_code=303)

    coupon = db.query(Coupon).filter(Coupon.id == coupon_id, Coupon.seller_id == user.id).first()
    if not coupon:
        request.session["seller_error"] = "Промокод не найден."
        return RedirectResponse("/seller/?tab=promocodes", status_code=303)

    coupon.is_active = 0 if int(coupon.is_active or 0) == 1 else 1
    db.commit()
    request.session["seller_success"] = (
        f"Промокод {coupon.code} {'активирован' if coupon.is_active else 'деактивирован'}."
    )
    return RedirectResponse("/seller/?tab=promocodes", status_code=303)


@router.get("/{seller_id}")
def seller_profile(seller_id: int, request: Request, db: Session = Depends(get_db)):
    seller = db.query(User).filter(
        User.id == seller_id,
        User.role == "seller",
        User.seller_application_status == "approved",
    ).first()
    if not seller:
        return RedirectResponse("/", status_code=303)

    products = db.query(Product).filter(Product.owner_id == seller_id, Product.status == "approved").all()
    avg_rating = (
        db.query(func.avg(SellerReview.rating))
        .filter(SellerReview.seller_id == seller_id, SellerReview.status == "approved")
        .scalar()
    )
    reviews = (
        db.query(SellerReview)
        .options(joinedload(SellerReview.user))
        .filter(SellerReview.seller_id == seller_id, SellerReview.status == "approved")
        .order_by(SellerReview.created_at.desc())
        .limit(10)
        .all()
    )
    certificates = (
        db.query(FarmCertificate)
        .filter(FarmCertificate.seller_id == seller_id)
        .order_by(FarmCertificate.id.desc())
        .all()
    )

    user = get_optional_user(request, db)
    return request.app.state.templates.TemplateResponse(
        request,
        "seller_profile",
        {
            "seller": seller,
            "products": products,
            "avg_rating": round(avg_rating, 1) if avg_rating else None,
            "reviews": reviews,
            "certificates": certificates,
            "user": user,
        },
    )
