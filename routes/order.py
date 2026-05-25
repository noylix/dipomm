from datetime import datetime
from decimal import Decimal
import os
import uuid

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from marketplace_utils import (
    MIN_ORDER_AMOUNT,
    effective_product_price,
    minimum_order_message,
    minimum_order_shortage,
    platform_commission_percent,
    product_stock_quantity,
    product_unit,
)
from models import (
    CartItem,
    Coupon,
    Delivery,
    Notification,
    Order,
    OrderItem,
    Product,
    Review,
    SellerReview,
    Transaction,
    User,
    Wallet,
)
from order_statuses import ORDER_STATUS_BADGES, ORDER_STATUS_LABELS, normalize_order_status

router = APIRouter(prefix="/order", tags=["order"])

DELIVERY_PRICES = {
    "courier": 500,
    "pickup": 0,
}
PAY_NOW_METHODS = {"yookassa"}
PAYMENT_METHODS = {"yookassa"}
DELIVERY_SLOTS = {
    "10-14": ("10:00", "14:00"),
    "14-18": ("14:00", "18:00"),
    "18-22": ("18:00", "22:00"),
}
def _store_checkout_form(request: Request, payload: dict[str, str]) -> None:
    request.session["checkout_form"] = payload


def _clear_checkout_form(request: Request) -> None:
    request.session.pop("checkout_form", None)


def _delivery_label(method: str) -> str:
    return {
        "courier": "РљСѓСЂСЊРµСЂ",
        "pickup": "РЎР°РјРѕРІС‹РІРѕР·",
        "post": "РџСѓРЅРєС‚ РІС‹РґР°С‡Рё",
        "market": "Р’С‹РґР°С‡Р° РЅР° СЂС‹РЅРєРµ",
    }.get(method, method)


def _payment_label(method: str) -> str:
    return {
        "yookassa": "Р®Kassa",
    }.get(method, method)


def _make_order_number() -> str:
    return f"FM-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _reserve_stock(cart_items: list[CartItem]) -> tuple[bool, str]:
    for item in cart_items:
        product = item.product
        if not product or product.status != "approved":
            return False, "\u041e\u0434\u0438\u043d \u0438\u0437 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0434\u043b\u044f \u0437\u0430\u043a\u0430\u0437\u0430."
        quantity = int(item.quantity or 0)
        available = product_stock_quantity(product)
        if quantity <= 0 or quantity > available:
            return False, (
                f"\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0442\u043e\u0432\u0430\u0440\u0430: {product.name}. "
                f"\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e {available} {product_unit(product)}"
            )
    for item in cart_items:
        if item.product:
            item.product.stock = product_stock_quantity(item.product) - int(item.quantity or 0)
    return True, ""


def _restore_order_stock(order: Order) -> None:
    for item in order.items or []:
        if item.product and item.quantity:
            item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)


def _charge_order(order: Order, user: User, db: Session, payment_method: str) -> tuple[bool, str]:
    if order.payment_status == "paid":
        return True, ""
    if payment_method not in PAYMENT_METHODS:
        return False, "РќРµРґРѕРїСѓСЃС‚РёРјС‹Р№ СЃРїРѕСЃРѕР± РѕРїР»Р°С‚С‹."

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    amount_to_pay = Decimal(order.total_price or 0)

    if payment_method == "wallet":
        if not wallet or Decimal(wallet.balance or 0) < amount_to_pay:
            return False, "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ РІ РєРѕС€РµР»СЊРєРµ."
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="completed",
            payment_method="wallet",
            description=f"РћРїР»Р°С‚Р° Р·Р°РєР°Р·Р° #{order.id}",
        ))
        wallet.balance = Decimal(wallet.balance or 0) - amount_to_pay
    else:
        if not wallet:
            wallet = Wallet(user_id=user.id, balance=0)
            db.add(wallet)
            db.flush()
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="completed",
            payment_method=payment_method,
            description=f"РћРїР»Р°С‚Р° Р·Р°РєР°Р·Р° #{order.id}",
            external_id=f"ext_{order.id}_{user.id}",
        ))

    order.payment_status = "paid"
    order.status = "paid"
    order.escrow_status = "pending"
    return True, ""


@router.post("/create")
def order_create(
    request: Request,
    full_name: str = Form(""),
    phone: str = Form(""),
    address: str = Form(""),
    delivery_method: str = Form("courier"),
    delivery_date: str = Form(""),
    delivery_slot_choice: str = Form("10-14"),
    comment: str = Form(""),
    payment_method: str = Form("yookassa"),
    coupon_code: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    checkout_form = {
        "full_name": (full_name or "").strip(),
        "phone": (phone or "").strip(),
        "address": (address or "").strip(),
        "delivery_method": (delivery_method or "").strip(),
        "delivery_date": (delivery_date or "").strip(),
        "delivery_slot_choice": (delivery_slot_choice or "").strip(),
        "comment": (comment or "").strip(),
        "payment_method": (payment_method or "").strip(),
        "coupon_code": (coupon_code or "").strip(),
    }

    # Backward compatibility for the old one-click checkout button.
    legacy_submit = not any([
        checkout_form["full_name"],
        checkout_form["phone"],
        checkout_form["address"],
        checkout_form["delivery_date"],
        checkout_form["delivery_slot_choice"],
        checkout_form["comment"],
        checkout_form["coupon_code"],
    ])
    if legacy_submit:
        checkout_form["full_name"] = (user.full_name or user.email or "РџРѕРєСѓРїР°С‚РµР»СЊ").strip()
        checkout_form["phone"] = (user.phone or "РќРµ СѓРєР°Р·Р°РЅ").strip()
        checkout_form["delivery_method"] = "pickup"
        checkout_form["payment_method"] = "yookassa"

    _store_checkout_form(request, checkout_form)

    if not checkout_form["full_name"] or not checkout_form["phone"]:
        request.session["cart_error"] = "Укажите имя и телефон получателя."
        return RedirectResponse(url="/cart/", status_code=303)

    if delivery_method not in DELIVERY_PRICES:
        request.session["cart_error"] = "Выберите корректный способ получения."
        return RedirectResponse(url="/cart/", status_code=303)

    if payment_method not in PAYMENT_METHODS:
        request.session["cart_error"] = "Выберите корректный способ оплаты."
        return RedirectResponse(url="/cart/", status_code=303)

    if delivery_slot_choice not in DELIVERY_SLOTS:
        request.session["cart_error"] = "Выберите корректный слот доставки."
        return RedirectResponse(url="/cart/", status_code=303)

    if delivery_method != "pickup" and not checkout_form["address"]:
        request.session["cart_error"] = "Для выбранного способа доставки нужен адрес."
        return RedirectResponse(url="/cart/", status_code=303)

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product).joinedload(Product.owner))
        .filter(CartItem.user_id == user.id)
        .all()
    )
    if not cart_items:
        request.session["cart_error"] = "Корзина пуста."
        return RedirectResponse(url="/cart/", status_code=303)

    subtotal = Decimal("0")
    for item in cart_items:
        product = item.product
        if not product:
            request.session["cart_error"] = "Один из товаров больше недоступен."
            return RedirectResponse(url="/cart/", status_code=303)
        subtotal += Decimal(effective_product_price(product)) * item.quantity

    if minimum_order_shortage(subtotal, MIN_ORDER_AMOUNT) > 0:
        request.session["cart_error"] = minimum_order_message(subtotal, MIN_ORDER_AMOUNT)
        return RedirectResponse(url="/cart/", status_code=303)

    coupon = None
    discount_amount = Decimal("0")
    if coupon_code:
        coupon = db.query(Coupon).filter(
            Coupon.code == coupon_code.upper().strip(),
            Coupon.is_active == 1,
        ).first()
        if not coupon or subtotal < Decimal(coupon.min_order or 0):
            request.session["cart_error"] = "Промокод не найден или не подходит для этой суммы заказа."
            db.rollback()
            return RedirectResponse(url="/cart/", status_code=303)
        discount_amount = (subtotal * Decimal(coupon.discount_percent) / Decimal("100")).quantize(Decimal("0.01"))
        coupon.usage_count += 1

    parsed_date = None
    if delivery_date:
        try:
            parsed_date = datetime.strptime(delivery_date, "%Y-%m-%d")
        except ValueError:
            parsed_date = None
    if not parsed_date:
        request.session["cart_error"] = "Выберите корректную дату доставки."
        return RedirectResponse(url="/cart/", status_code=303)

    now = datetime.now()
    today = now.date()
    if parsed_date.date() < today:
        request.session["cart_error"] = "Нельзя выбрать дату в прошлом."
        return RedirectResponse(url="/cart/", status_code=303)
    slot_start, slot_end = DELIVERY_SLOTS[delivery_slot_choice]
    if parsed_date.date() == today:
        end_hour = int(slot_end.split(":")[0])
        if now.hour >= end_hour:
            request.session["cart_error"] = "Выбранный слот уже прошёл. Выберите следующий."
            return RedirectResponse(url="/cart/", status_code=303)

    delivery_price = Decimal(str(DELIVERY_PRICES[delivery_method]))
    goods_total = subtotal - discount_amount
    total_price = goods_total + delivery_price
    commission_percent = platform_commission_percent(db)
    platform_fee = (goods_total * commission_percent / Decimal("100")).quantize(Decimal("0.01"))
    delivery_slot = f"{delivery_date.strip()} {slot_start}-{slot_end}"

    ok, stock_error = _reserve_stock(cart_items)
    if not ok:
        request.session["cart_error"] = stock_error
        return RedirectResponse(url="/cart/", status_code=303)

    order = Order(
        order_number=_make_order_number(),
        user_id=user.id,
        total_price=total_price,
        status="created",
        payment_status="pending",
        customer_name=checkout_form["full_name"],
        customer_phone=checkout_form["phone"],
        delivery_address=checkout_form["address"] or None,
        delivery_method=delivery_method,
        delivery_slot=delivery_slot or None,
        customer_comment=checkout_form["comment"] or None,
        selected_payment_method=payment_method,
        delivery_fee=delivery_price,
        platform_fee=platform_fee,
        coupon_id=coupon.id if coupon else None,
        discount_amount=discount_amount,
    )
    db.add(order)
    db.flush()

    db.add(Delivery(
        order_id=order.id,
        address=checkout_form["address"] or "Самовывоз",
        method=delivery_method,
        delivery_date=parsed_date,
    ))

    for item in cart_items:
        db.add(OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity))
        db.delete(item)

    if payment_method in PAY_NOW_METHODS:
        paid, payment_error = _charge_order(order, user, db, payment_method)
        if not paid:
            db.rollback()
            request.session["cart_error"] = payment_error
            return RedirectResponse(url="/cart/", status_code=303)

    db.add(Notification(
        user_id=user.id,
        type="email",
        subject="Р—Р°РєР°Р· СЃРѕР·РґР°РЅ",
        body=(
            f"Р—Р°РєР°Р· #{order.id} СЃРѕР·РґР°РЅ. "
            f"Способ получения: {_delivery_label(delivery_method)}. "
            f"РћРїР»Р°С‚Р°: {_payment_label(payment_method)}."
        ),
    ))
    db.commit()

    _clear_checkout_form(request)
    request.session["order_success"] = (
        f"Р—Р°РєР°Р· #{order.id} РѕС„РѕСЂРјР»РµРЅ. "
        + ("РћРїР»Р°С‚Р° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°." if order.payment_status == "paid" else "РЎС‚Р°С‚СѓСЃ: РѕР¶РёРґР°РµС‚ РѕРїР»Р°С‚С‹.")
    )
    if payment_method == "yookassa":
        return RedirectResponse(url=f"/payment/{order.id}", status_code=303)
    return RedirectResponse(url="/order/orders", status_code=303)


@router.get("/orders")
def orders_list(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    orders = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.delivery),
        )
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )
    reviewed = db.query(Review).filter(Review.user_id == user.id).all()
    reviewed_pairs = {(r.product_id, r.order_id) for r in reviewed}
    seller_reviews = db.query(SellerReview).filter(SellerReview.user_id == user.id).all()
    reviewed_seller_keys = [f"{r.order_id}:{r.seller_id}" for r in seller_reviews if r.order_id and r.seller_id]

    return request.app.state.templates.TemplateResponse(
        request,
        "order",
        {
            "orders": orders,
            "user": user,
            "reviewed_pairs": reviewed_pairs,
            "reviewed_seller_keys": reviewed_seller_keys,
            "status_labels": ORDER_STATUS_LABELS,
            "status_badges": ORDER_STATUS_BADGES,
            "order_success": request.session.pop("order_success", None),
            "payment_success": request.session.pop("payment_success", None),
            "payment_error": request.session.pop("payment_error", None),
        },
    )


@router.get("/{order_id}/receipt")
def order_receipt(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.delivery),
        )
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if not order:
        return RedirectResponse("/order/orders", status_code=303)

    return request.app.state.templates.TemplateResponse(
        request,
        "order_receipt",
        {
            "order": order,
            "user": user,
            "status_labels": ORDER_STATUS_LABELS,
        },
    )


@router.post("/{order_id}/pay")
def order_pay_stub(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if order and order.payment_status == "pending":
        payment_method = order.selected_payment_method or "card"
        if payment_method == "yookassa":
            return RedirectResponse(f"/payment/{order.id}", status_code=303)
        if payment_method == "cash":
            payment_method = "card"
        paid, payment_error = _charge_order(order, user, db, payment_method)
        if not paid:
            request.session["payment_error"] = payment_error
            return RedirectResponse("/order/orders", status_code=303)
        db.add(Notification(
            user_id=order.user_id,
            type="email",
            subject="РћРїР»Р°С‚Р° РїРѕР»СѓС‡РµРЅР°",
            body=f"Р—Р°РєР°Р· #{order.id} РѕРїР»Р°С‡РµРЅ. РЎСЂРµРґСЃС‚РІР° Р·Р°РјРѕСЂРѕР¶РµРЅС‹ РґРѕ РїРѕР»СѓС‡РµРЅРёСЏ С‚РѕРІР°СЂР°.",
        ))
        db.commit()
        request.session["payment_success"] = f"Р—Р°РєР°Р· #{order.id} РѕРїР»Р°С‡РµРЅ"
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/{order_id}/complete")
def order_complete(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if order and normalize_order_status(order.status) in ("confirmed", "paid", "assembling", "shipped", "delivering"):
        order.status = "completed"
        order.escrow_status = "released"
        db.commit()

        db.add(Notification(
            user_id=order.user_id,
            type="email",
            subject="Р—Р°РєР°Р· Р·Р°РІРµСЂС€РµРЅ",
            body=f"Р—Р°РєР°Р· #{order.id} РїРѕР»СѓС‡РµРЅ. РЎРїР°СЃРёР±Рѕ Р·Р° РїРѕРєСѓРїРєСѓ!",
        ))
        db.commit()
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/{order_id}/cancel")
def order_cancel(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if order and order.payment_status == "pending" and normalize_order_status(order.status) == "created":
        order.status = "canceled"
        _restore_order_stock(order)
        db.commit()
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/{order_id}/repeat")
def order_repeat(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if not order:
        request.session["payment_error"] = "Заказ не найден."
        return RedirectResponse("/order/orders", status_code=303)

    added_count = 0
    skipped_names: list[str] = []

    for item in order.items or []:
        product = item.product
        if not product or product.status != "approved":
            skipped_names.append(product.name if product else f"#{item.product_id}")
            continue

        available = product_stock_quantity(product)
        if available <= 0:
            skipped_names.append(product.name)
            continue

        existing = (
            db.query(CartItem)
            .filter(CartItem.user_id == user.id, CartItem.product_id == item.product_id)
            .first()
        )
        existing_quantity = int(existing.quantity or 0) if existing else 0
        quantity_to_add = min(int(item.quantity or 0), available - existing_quantity)
        if quantity_to_add <= 0:
            skipped_names.append(product.name)
            continue
        if existing:
            existing.quantity += quantity_to_add
        else:
            db.add(CartItem(
                user_id=user.id,
                product_id=item.product_id,
                quantity=quantity_to_add,
            ))
        added_count += 1

    if added_count == 0:
        request.session["payment_error"] = "Не удалось повторить заказ: все товары сейчас недоступны."
        return RedirectResponse("/order/orders", status_code=303)

    db.commit()

    if skipped_names:
        visible_names = ", ".join(skipped_names[:3])
        if len(skipped_names) > 3:
            visible_names += ", ..."
        request.session["cart_success"] = (
            f"Р’ РєРѕСЂР·РёРЅСѓ РґРѕР±Р°РІР»РµРЅС‹ С‚РѕРІР°СЂС‹ РёР· Р·Р°РєР°Р·Р° #{order.id}. "
            f"РќРµРґРѕСЃС‚СѓРїРЅС‹Рµ РїРѕР·РёС†РёРё РїСЂРѕРїСѓС‰РµРЅС‹: {visible_names}."
        )
    else:
        request.session["cart_success"] = f"РўРѕРІР°СЂС‹ РёР· Р·Р°РєР°Р·Р° #{order.id} СЃРЅРѕРІР° РґРѕР±Р°РІР»РµРЅС‹ РІ РєРѕСЂР·РёРЅСѓ."

    return RedirectResponse("/cart/", status_code=303)


@router.post("/{order_id}/return")
def order_return(
    order_id: int,
    request: Request,
    reason: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if order and normalize_order_status(order.status) == "completed" and not order.return_status:
        order.return_status = "requested"
        order.return_reason = reason
        db.commit()
    return RedirectResponse("/order/orders", status_code=303)


