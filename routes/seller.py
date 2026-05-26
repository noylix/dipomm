import os
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from logistics import ensure_logistics_shipment, mark_shipment_in_transit
from marketplace_utils import effective_product_price, product_price_payload, product_stock_quantity
from models import Complaint, Conversation, FarmCertificate, Message, Notification, Order, OrderItem, Product, Review, SellerReview, User
from order_statuses import ORDER_STATUS_LABELS, normalize_order_status
from routes.conversations import _save_attachment, upsert_support_conversation

UPLOAD_DIR = os.path.join("static", "uploads", "products")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
FARM_UPLOAD_DIR = os.path.join("static", "uploads", "farms")
os.makedirs(FARM_UPLOAD_DIR, exist_ok=True)
CERT_UPLOAD_DIR = FARM_UPLOAD_DIR
ALLOWED_FARM_EXT = ALLOWED_IMAGE_EXT

router = APIRouter(prefix="/seller", tags=["seller"])

SELLER_STATUS_TRANSITIONS = {
    "confirm": "confirmed",
    "assemble": "assembling",
    "ship": "shipped",
    "deliver": "delivering",
    "cancel": "canceled",
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


def _save_product_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(upload.file.read())
    return f"/static/uploads/products/{filename}"


def _save_farm_photo(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_FARM_EXT:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(FARM_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(upload.file.read())
    return f"/static/uploads/farms/{filename}"


def _save_certificate_image(upload: UploadFile | None) -> str | None:
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_FARM_EXT:
        return None
    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(CERT_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(upload.file.read())
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
        normalized_status = normalize_order_status(order.status)
        if order.payment_status != "paid" or normalized_status in {"canceled", "refunded"}:
            continue

        seller_goods_total, seller_fee, seller_net = _seller_money_breakdown(order, seller_id)
        if seller_goods_total <= 0:
            continue

        paid_orders_count += 1
        gross_revenue += seller_goods_total
        platform_fee += seller_fee

        if (order.escrow_status or "pending") == "pending":
            pending_payout += seller_net

    return {
        "paid_orders_count": paid_orders_count,
        "gross_revenue": round(float(gross_revenue), 2),
        "platform_fee": round(float(platform_fee), 2),
        "pending_payout": round(float(pending_payout), 2),
    }


def _seller_is_approved(user: User | None) -> bool:
    return bool(user and user.role == "seller" and user.seller_application_status == "approved")


def _seller_dashboard_context(user: User, db: Session, request: Request, initial_tab: str = "overview") -> dict[str, object]:
    if user.role == "admin":
        products = db.query(Product).all()
        financials = None
        certificates = []
    else:
        products = db.query(Product).filter(Product.owner_id == user.id).all()
        financials = _build_seller_financials(user.id, db)
        certificates = (
            db.query(FarmCertificate)
            .filter(FarmCertificate.seller_id == user.id)
            .order_by(FarmCertificate.id.desc())
            .all()
        )
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
    return {
        "seller": user,
        "products": products,
        "user": user,
        "financials": financials,
        "certificates": certificates,
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
            "application_rejection_reason": user.seller_application_rejection_reason,
            "notice_message": request.session.pop("seller_pending_notice", None),
        },
    )


@router.get("/")
def seller_panel(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    if user.role == "seller" and not _seller_is_approved(user):
        return RedirectResponse("/seller/pending", status_code=303)

    return request.app.state.templates.TemplateResponse(
        request,
        "seller",
        _seller_dashboard_context(user, db, request),
    )


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
        _seller_dashboard_context(user, db, request, initial_tab="profile"),
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
            "items": seller_items,
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
    allowed_actions = {
        "created": {"confirm", "assemble", "cancel"},
        "confirmed": {"assemble", "cancel"},
        "paid": {"assemble", "cancel"},
        "assembling": {"ship", "cancel"},
        "shipped": {"deliver"},
        "delivering": set(),
        "completed": set(),
        "canceled": set(),
        "refunded": set(),
    }
    if action not in allowed_actions.get(current_status, set()):
        request.session["seller_order_error"] = "Для этого заказа сейчас недоступно выбранное действие."
        return RedirectResponse("/seller/orders", status_code=303)

    if action != "cancel" and order.payment_status != "paid":
        request.session["seller_order_error"] = "Заказ еще не оплачен. Дождитесь подтверждения оплаты."
        return RedirectResponse("/seller/orders", status_code=303)

    cancel_reason = (cancel_reason or "").strip()
    if action == "cancel" and len(cancel_reason) < 5:
        request.session["seller_order_error"] = "Укажите причину отмены заказа."
        return RedirectResponse("/seller/orders", status_code=303)

    order.status = next_status

    if next_status == "canceled":
        order.return_reason = "Отменено продавцом"
        order.seller_cancel_reason = cancel_reason
        _restore_order_stock(order)
    else:
        order.seller_cancel_reason = None

    delivery = None
    if next_status == "shipped":
        delivery = ensure_logistics_shipment(order)
    elif next_status == "delivering":
        delivery = mark_shipment_in_transit(order)

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
    has_certificate: int = Form(0),
    region: str = Form(""),
    stock: int = Form(0),
    unit: str = Form("\u0448\u0442"),
    low_stock_threshold: int = Form(0),
    description: str = Form(""),
    image: UploadFile = File(None),
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

    image_url = _save_product_image(image)
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
        has_certificate=has_certificate,
        region=region or None,
        stock=stock,
        unit=(unit or "\u0448\u0442").strip(),
        low_stock_threshold=low_stock_threshold,
        image_url=image_url,
        description=description or None,
        status=initial_status,
    )
    db.add(product)
    db.commit()
    return RedirectResponse(url="/seller/", status_code=303)


@router.get("/product/edit/{product_id}")
def seller_edit_product_page(product_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard
    product = db.query(Product).filter(Product.id == product_id).first()
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
    has_certificate: int = Form(0),
    region: str = Form(""),
    stock: int = Form(0),
    unit: str = Form("\u0448\u0442"),
    low_stock_threshold: int = Form(0),
    description: str = Form(""),
    image: UploadFile = File(None),
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

    product.name = name
    product.price = price
    product.discount_price = parsed_discount
    product.category = category
    product.variety = variety or None
    product.weight_per_unit = weight_per_unit or None
    product.expiration_days = expiration_days if expiration_days > 0 else None
    product.has_certificate = has_certificate
    product.region = region or None
    product.stock = stock
    product.unit = (unit or "\u0448\u0442").strip()
    product.low_stock_threshold = low_stock_threshold
    product.description = description or None

    new_image_url = _save_product_image(image)
    if new_image_url:
        product.image_url = new_image_url
    elif not keep_image:
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

    user.full_name = full_name.strip() or None
    user.phone = phone.strip() or None
    user.farm_name = farm_name.strip() or None
    user.farm_address = farm_address.strip() or None
    user.product_categories = product_categories.strip() or None
    user.farm_description = farm_description.strip() or None
    user.inn = None
    user.supplier_registration_data = None
    user.supplier_bank_details = None
    user.passport_photo_url = None
    user.supplier_document_url = None
    farm_photo_url = _save_farm_photo(farm_photo)
    if farm_photo_url:
        user.farm_photo_url = farm_photo_url
    db.commit()
    request.session["seller_error"] = None
    request.session["seller_success"] = "\u0410\u043d\u043a\u0435\u0442\u0430 \u0444\u0435\u0440\u043c\u0435\u0440\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430."
    return RedirectResponse("/seller/", status_code=303)


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
