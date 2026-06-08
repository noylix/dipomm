from datetime import datetime
from decimal import Decimal
import uuid

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import update
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user, is_email_verified
from cdek_delivery import CDEK_PROVIDER_NAME, calculate_cdek_delivery_quote, create_test_cdek_shipment
from coupon_utils import coupon_applies_to_group, evaluate_coupon, group_discounts
from database import get_db
from delivery_service import (
    DELIVERY_METHODS,
    DELIVERY_SLOTS,
    create_order_delivery,
    delivery_label,
    delivery_option,
    normalize_delivery_method,
    seller_delivery_options,
    seller_minimum,
    seller_pickup_address,
    seller_slots,
)
from email_utils import send_email, smtp_is_configured
from phone_utils import format_ru_phone, is_valid_ru_phone
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
from order_cancellation import cancel_order
from order_statuses import (
    ORDER_STATUS_BADGES,
    ORDER_STATUS_LABELS,
    is_order_payable,
    is_order_receivable,
    normalize_order_status,
)
router = APIRouter(prefix="/order", tags=["order"])

PAY_NOW_METHODS = set()
PAYMENT_METHODS = {"yookassa"}
def _store_checkout_form(request: Request, payload: dict[str, str]) -> None:
    request.session["checkout_form"] = payload


def _clear_checkout_form(request: Request) -> None:
    request.session.pop("checkout_form", None)


def _delivery_label(method: str) -> str:
    return {
        "farmer_delivery": "Доставка фермером",
        "partner_delivery": CDEK_PROVIDER_NAME,
        "courier": "Доставка фермером",
        "pickup": "Самовывоз",
        "post": CDEK_PROVIDER_NAME,
        "market": "Самовывоз",
    }.get(method, method)


def _payment_label(method: str) -> str:
    return {
        "yookassa": "ЮKassa",
    }.get(method, method)


def _make_order_number() -> str:
    return f"FM-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _normalize_delivery_method(method: str | None) -> str:
    return normalize_delivery_method(method)


def _seller_slots(seller: User | None) -> list[str]:
    raw = (getattr(seller, "delivery_slots", None) or "10-14,14-18,18-22").strip()
    slots = [slot.strip() for slot in raw.replace(";", ",").split(",") if slot.strip() in DELIVERY_SLOTS]
    return slots or list(DELIVERY_SLOTS)


def _seller_minimum(seller: User | None, method: str | None = None) -> Decimal:
    base = max(Decimal(str((seller.min_order_amount if seller else 0) or 0)), MIN_ORDER_AMOUNT)
    if method == "farmer_delivery" and seller:
        delivery_min = Decimal(str(seller.farmer_delivery_min_order or 0))
        return max(base, delivery_min)
    return base


def _seller_pickup_address(seller: User | None) -> str:
    if not seller:
        return ""
    return (seller.pickup_address or seller.farm_address or "").strip()


def _seller_delivery_options(seller: User | None) -> list[dict[str, object]]:
    if not seller:
        return []
    options: list[dict[str, object]] = []
    if int(seller.pickup_enabled or 0):
        options.append({
            "method": "pickup",
            "label": "Самовывоз",
            "fee": 0.0,
            "requires_address": False,
            "address": _seller_pickup_address(seller),
            "pickup_address": _seller_pickup_address(seller),
            "comment": seller.pickup_comment or "",
        })
    if int(seller.farmer_delivery_enabled or 0):
        options.append({
            "method": "farmer_delivery",
            "label": "Доставка фермером",
            "fee": float(seller.farmer_delivery_fee or 0),
            "requires_address": True,
            "min_order": float(_seller_minimum(seller, "farmer_delivery")),
            "comment": seller.farmer_delivery_comment or "",
        })
    if int(seller.partner_delivery_enabled or 0):
        options.append({
            "method": "partner_delivery",
            "label": CDEK_PROVIDER_NAME,
            "fee": float(seller.partner_delivery_fee or 0),
            "requires_address": True,
            "comment": seller.partner_delivery_comment or "Фермер подключил доставку СДЭК. Стоимость рассчитывается через СДЭК, после оплаты будет создана накладная.",
        })
    return options


def _delivery_option(seller: User | None, method: str) -> dict[str, object] | None:
    for option in _seller_delivery_options(seller):
        if option["method"] == method:
            return option
    return None


def _set_order_paid(order: Order, payment_id: str | None = None) -> None:
    amount = Decimal(order.total_price or 0)
    order.payment_status = "paid"
    order.status = "confirmed"
    order.escrow_status = "pending"
    order.payment_id = payment_id or order.payment_id
    order.payment_amount = amount
    order.paid_at = datetime.utcnow()
    if order.delivery:
        order.delivery.status = "waiting_assembly"


def _reserve_stock(cart_items: list[CartItem], db: Session) -> tuple[bool, str]:
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
            quantity = int(item.quantity or 0)
            result = db.execute(
                update(Product)
                .where(
                    Product.id == item.product_id,
                    Product.status == "approved",
                    Product.stock >= quantity,
                )
                .values(stock=Product.stock - quantity)
            )
            if result.rowcount != 1:
                return False, (
                    f"Недостаточно товара: {item.product.name}. "
                    f"Доступно только {product_stock_quantity(item.product)} {product_unit(item.product)}"
                )
            db.refresh(item.product)
    return True, ""


def _restore_order_stock(order: Order) -> None:
    for item in order.items or []:
        if item.product and item.quantity:
            item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)


def _charge_order(order: Order, user: User, db: Session, payment_method: str) -> tuple[bool, str]:
    if order.payment_status == "paid":
        return True, ""
    if not is_order_payable(order.status, order.payment_status):
        return False, "Заказ уже нельзя оплатить."
    if payment_method not in PAYMENT_METHODS:
        return False, "Недопустимый способ оплаты."

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    amount_to_pay = Decimal(order.total_price or 0)

    if payment_method == "wallet":
        if not wallet or Decimal(wallet.balance or 0) < amount_to_pay:
            return False, "Недостаточно средств в кошельке."
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="completed",
            payment_method="wallet",
            description=f"Оплата заказа #{order.id}",
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
            description=f"Оплата заказа #{order.id}",
            external_id=f"ext_{order.id}_{user.id}",
        ))

    _set_order_paid(order, f"demo_{payment_method}_{order.id}")
    return True, ""


@router.post("/create")
async def order_create(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    if not is_email_verified(user):
        request.session["cart_error"] = (
            "Подтвердите email, чтобы оформить заказ. "
            "Проверьте почту или нажмите «Отправить письмо повторно» в корзине."
        )
        return RedirectResponse(url="/cart/", status_code=303)

    form = await request.form()
    checkout_form = {
        "full_name": (form.get("full_name") or "").strip(),
        "phone": (form.get("phone") or "").strip(),
        "address": (form.get("address") or "").strip(),
        "delivery_method": (form.get("delivery_method") or "").strip(),
        "delivery_date": (form.get("delivery_date") or "").strip(),
        "delivery_slot_choice": (form.get("delivery_slot_choice") or "").strip(),
        "comment": (form.get("comment") or "").strip(),
        "payment_method": (form.get("payment_method") or "yookassa").strip(),
        "coupon_code": (form.get("coupon_code") or "").strip(),
        "seller_id": (form.get("seller_id") or "").strip(),
    }

    # Backward compatibility for the old one-click checkout button.
    legacy_submit = not any([
        checkout_form["full_name"],
        checkout_form["phone"],
        checkout_form["address"],
        checkout_form["delivery_date"],
        checkout_form["comment"],
        checkout_form["coupon_code"],
        checkout_form["seller_id"],
    ])
    if legacy_submit:
        now = datetime.now()
        delivery_date_value = now.strftime("%Y-%m-%d")
        delivery_slot_value = next(
            (slot for slot, (_, end) in DELIVERY_SLOTS.items() if now.hour < int(end.split(":")[0])),
            None,
        )
        if not delivery_slot_value:
            delivery_date_value = datetime.fromtimestamp(now.timestamp() + 86400).strftime("%Y-%m-%d")
            delivery_slot_value = next(iter(DELIVERY_SLOTS))
        checkout_form["full_name"] = (user.full_name or user.email or "Покупатель").strip()
        checkout_form["phone"] = (user.phone or "Не указан").strip()
        checkout_form["delivery_method"] = "pickup"
        checkout_form["delivery_date"] = delivery_date_value
        checkout_form["delivery_slot_choice"] = delivery_slot_value
        checkout_form["payment_method"] = "yookassa"

    delivery_method = _normalize_delivery_method(checkout_form["delivery_method"])
    if not delivery_method:
        delivery_method = "pickup"
    checkout_form["delivery_method"] = delivery_method
    payment_method = checkout_form["payment_method"]
    delivery_slot_choice = checkout_form["delivery_slot_choice"] or next(iter(DELIVERY_SLOTS))
    coupon_code = checkout_form["coupon_code"]
    delivery_date = checkout_form["delivery_date"] or datetime.now().strftime("%Y-%m-%d")
    checkout_form["delivery_slot_choice"] = delivery_slot_choice
    checkout_form["delivery_date"] = delivery_date

    _store_checkout_form(request, checkout_form)

    if not checkout_form["full_name"] or not checkout_form["phone"]:
        request.session["cart_error"] = "Укажите имя и телефон получателя."
        return RedirectResponse(url="/cart/", status_code=303)

    if not is_valid_ru_phone(checkout_form["phone"]):
        request.session["cart_error"] = "Укажите номер телефона полностью в формате +7 (999) 999-99-99."
        return RedirectResponse(url="/cart/", status_code=303)

    checkout_form["phone"] = format_ru_phone(checkout_form["phone"])

    if delivery_method not in DELIVERY_METHODS:
        request.session["cart_error"] = "Выберите корректный способ получения."
        return RedirectResponse(url="/cart/", status_code=303)

    if payment_method not in PAYMENT_METHODS:
        request.session["cart_error"] = "Выберите корректный способ оплаты."
        return RedirectResponse(url="/cart/", status_code=303)

    if delivery_slot_choice not in DELIVERY_SLOTS:
        request.session["cart_error"] = "Выберите корректный слот доставки."
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

    requested_seller_id = None
    has_seller_filter = False
    if checkout_form["seller_id"]:
        has_seller_filter = True
        if checkout_form["seller_id"] != "__none__":
            try:
                requested_seller_id = int(checkout_form["seller_id"])
            except ValueError:
                request.session["cart_error"] = "Выберите корректного продавца для оформления."
                return RedirectResponse(url="/cart/", status_code=303)
        cart_items = [
            item for item in cart_items
            if item.product and item.product.owner_id == requested_seller_id
        ]
        if not cart_items:
            request.session["cart_error"] = "В корзине нет товаров выбранного продавца."
            return RedirectResponse(url="/cart/", status_code=303)

    seller_groups: dict[int | None, list[CartItem]] = {}
    for item in cart_items:
        product = item.product
        if not product or product.status != "approved":
            request.session["cart_error"] = "Один из товаров больше недоступен."
            return RedirectResponse(url="/cart/", status_code=303)
        seller_groups.setdefault(product.owner_id, []).append(item)

    if not seller_groups:
        request.session["cart_error"] = "Корзина пуста."
        return RedirectResponse(url="/cart/", status_code=303)

    group_payloads: list[dict[str, object]] = []
    subtotal = Decimal("0")
    for seller_id, group_items in seller_groups.items():
        seller = group_items[0].product.owner if group_items and group_items[0].product else None
        if not seller or not _seller_delivery_options(seller):
            request.session["cart_error"] = "У одного из фермеров не настроен ни один способ получения."
            return RedirectResponse(url="/cart/", status_code=303)

        key = "__none__" if seller_id is None else str(seller_id)
        selected_method = _normalize_delivery_method(form.get(f"delivery_method_{key}") or delivery_method)
        option = _delivery_option(seller, selected_method)
        if not option:
            request.session["cart_error"] = f"{seller.farm_name or seller.full_name or 'Фермер'} не поддерживает выбранный способ получения."
            return RedirectResponse(url="/cart/", status_code=303)

        cdek_city_code = (form.get(f"cdek_city_code_{key}") or "").strip()
        cdek_city = (form.get(f"cdek_city_{key}") or "").strip()
        raw_cdek_delivery_type = (form.get(f"cdek_delivery_type_{key}") or "pickup").strip()
        cdek_delivery_type = "door" if raw_cdek_delivery_type == "door" else "pickup"
        cdek_delivery_point = (form.get(f"cdek_delivery_point_{key}") or "").strip()
        selected_date = (form.get(f"delivery_date_{key}") or delivery_date).strip()
        selected_slot = (form.get(f"delivery_slot_choice_{key}") or delivery_slot_choice).strip()
        selected_address = (form.get(f"address_{key}") or checkout_form["address"]).strip()
        selected_comment = (form.get(f"comment_{key}") or checkout_form["comment"]).strip()

        if selected_slot not in _seller_slots(seller):
            request.session["cart_error"] = "Выберите доступный временной слот."
            return RedirectResponse(url="/cart/", status_code=303)
        if selected_method == "partner_delivery":
            if not cdek_city_code:
                request.session["cart_error"] = "Выберите город СДЭК и рассчитайте доставку."
                return RedirectResponse(url="/cart/", status_code=303)
            if cdek_delivery_type != "door" and not cdek_delivery_point:
                request.session["cart_error"] = "Выберите пункт выдачи СДЭК."
                return RedirectResponse(url="/cart/", status_code=303)
            if cdek_delivery_type == "door" and not selected_address:
                request.session["cart_error"] = "Для доставки СДЭК до двери нужен адрес."
                return RedirectResponse(url="/cart/", status_code=303)
        elif bool(option.get("requires_address")) and not selected_address:
            request.session["cart_error"] = "Для доставки нужен адрес."
            return RedirectResponse(url="/cart/", status_code=303)
        if selected_method == "pickup":
            selected_address = _seller_pickup_address(seller)

        group_subtotal = sum(Decimal(effective_product_price(i.product)) * int(i.quantity or 0) for i in group_items if i.product)
        delivery_fee = Decimal(str(option.get("fee") or 0))
        cdek_quote = None
        if selected_method == "partner_delivery":
            try:
                cdek_quote = calculate_cdek_delivery_quote(group_items, int(cdek_city_code), cdek_delivery_type)
                delivery_fee = cdek_quote.delivery_sum
            except Exception as exc:
                request.session["cart_error"] = f"СДЭК не рассчитал доставку: {exc}"
                return RedirectResponse(url="/cart/", status_code=303)
        seller_minimum = _seller_minimum(seller, selected_method)
        if minimum_order_shortage(group_subtotal, seller_minimum) > 0:
            request.session["cart_error"] = minimum_order_message(group_subtotal, seller_minimum)
            return RedirectResponse(url="/cart/", status_code=303)
        subtotal += group_subtotal
        group_payloads.append({
            "seller_id": seller_id,
            "seller": seller,
            "items": group_items,
            "method": selected_method,
            "date": selected_date,
            "slot": selected_slot,
            "address": selected_address,
            "comment": selected_comment,
            "delivery_fee": delivery_fee,
            "subtotal": group_subtotal,
            "cdek_city_code": cdek_city_code,
            "cdek_city": cdek_city,
            "cdek_delivery_type": cdek_delivery_type,
            "cdek_delivery_point": cdek_delivery_point,
            "cdek_tariff_code": cdek_quote.tariff_code if cdek_quote else None,
        })

    coupon = None
    discount_amount = Decimal("0")
    if coupon_code:
        seller_subtotals = {group["seller_id"]: group["subtotal"] for group in group_payloads}
        coupon, discount_amount, coupon_error = evaluate_coupon(db, coupon_code, seller_subtotals)
        if coupon_error:
            request.session["cart_error"] = coupon_error
            return RedirectResponse(url="/cart/", status_code=303)
        if coupon:
            coupon.usage_count = int(coupon.usage_count or 0) + 1

    per_group_discount = group_discounts(coupon, group_payloads, discount_amount)

    now = datetime.now()
    today = now.date()
    for group in group_payloads:
        parsed_date = None
        if group["date"]:
            try:
                parsed_date = datetime.strptime(str(group["date"]), "%Y-%m-%d")
            except ValueError:
                parsed_date = None
        if not parsed_date:
            request.session["cart_error"] = "Выберите корректную дату получения или доставки."
            return RedirectResponse(url="/cart/", status_code=303)
        if parsed_date.date() < today:
            request.session["cart_error"] = "Нельзя выбрать дату в прошлом."
            return RedirectResponse(url="/cart/", status_code=303)
        slot_start, slot_end = DELIVERY_SLOTS[str(group["slot"])]
        if parsed_date.date() == today and now.hour >= int(slot_end.split(":")[0]):
            request.session["cart_error"] = "Выбранный слот уже прошёл. Выберите следующий."
            return RedirectResponse(url="/cart/", status_code=303)
        group["parsed_date"] = parsed_date
        group["delivery_slot"] = f"{group['date']} {slot_start}-{slot_end}"

    goods_total = subtotal - discount_amount
    commission_percent = platform_commission_percent(db)

    ok, stock_error = _reserve_stock(cart_items, db)
    if not ok:
        db.rollback()
        request.session["cart_error"] = stock_error
        return RedirectResponse(url="/cart/", status_code=303)

    created_orders: list[Order] = []
    for group in group_payloads:
        group_discount = per_group_discount.get(group["seller_id"], Decimal("0"))
        group_goods_total = Decimal(group["subtotal"]) - group_discount
        delivery_price = Decimal(group["delivery_fee"])
        total_price = group_goods_total + delivery_price
        platform_fee = (group_goods_total * commission_percent / Decimal("100")).quantize(Decimal("0.01"))

        order = Order(
            order_number=_make_order_number(),
            user_id=user.id,
            total_price=total_price,
            status="awaiting_payment",
            payment_status="pending",
            customer_name=checkout_form["full_name"],
            customer_phone=checkout_form["phone"],
            delivery_address=(group["address"] or None) if group["method"] != "pickup" else (_seller_pickup_address(group["seller"]) or None),
            delivery_method=group["method"],
            delivery_slot=group["delivery_slot"],
            customer_comment=group["comment"] or None,
            selected_payment_method=payment_method,
            delivery_fee=delivery_price,
            platform_fee=platform_fee,
            coupon_id=coupon.id if coupon_applies_to_group(coupon, group["seller_id"]) else None,
            discount_amount=group_discount,
        )
        db.add(order)
        db.flush()

        delivery = Delivery(
            order_id=order.id,
            address=group["address"] or None,
            method=group["method"],
            status="waiting_payment",
            delivery_date=group["parsed_date"],
            delivery_slot=group["delivery_slot"],
            comment=group["comment"] or None,
            delivery_fee=delivery_price,
        )
        if group["method"] == "pickup":
            delivery.address = _seller_pickup_address(group["seller"]) or None
        elif group["method"] == "partner_delivery":
            cdek_shipment = create_test_cdek_shipment(order)
            delivery.provider = cdek_shipment.provider
            delivery.provider_name = cdek_shipment.provider
            delivery.track_number = cdek_shipment.track_number
            delivery.tracking_url = cdek_shipment.tracking_url
            delivery.external_id = (
                f"CDEK-PENDING:{group['cdek_city_code']}:{group['cdek_delivery_type']}:{group['cdek_delivery_point'] or ''}"
            )
            delivery.comment = "\n".join(filter(None, [
                group["comment"] or "",
                f"СДЭК: {group['cdek_city'] or group['cdek_city_code']}; "
                f"{'до двери' if group['cdek_delivery_type'] == 'door' else 'ПВЗ'} "
                f"{group['cdek_delivery_point'] or group['address'] or ''}; "
                f"тариф {group['cdek_tariff_code'] or ''}".strip(),
            ]))
        db.add(delivery)

        for item in group["items"]:
            db.add(OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity))
            db.delete(item)

        created_orders.append(order)
        db.add(Notification(
            user_id=user.id,
            type="email",
            subject=f"Заказ #{order.order_number or order.id} ожидает оплаты",
            body=(
                f"Заказ #{order.order_number or order.id} создан. "
                f"Способ получения: {_delivery_label(str(group['method']))}. "
                f"Сумма к оплате: {float(total_price):.2f} ₽."
            ),
        ))

    db.commit()

    if smtp_is_configured() and user.email:
        for order in created_orders:
            try:
                send_email(user.email, f"Заказ #{order.order_number or order.id} ожидает оплаты", "Заказ будет подтверждён только после успешной оплаты.")
            except Exception:
                pass

    _clear_checkout_form(request)
    order_ids = ", ".join(f"#{order.id}" for order in created_orders)
    request.session["order_success"] = f"Созданы заказы {order_ids}. Статус: ожидает оплаты."
    if payment_method == "yookassa":
        return RedirectResponse(url=f"/payment/{created_orders[0].id}", status_code=303)
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
    if order and is_order_payable(order.status, order.payment_status):
        payment_method = order.selected_payment_method or "card"
        if payment_method in {"yookassa", "wallet"}:
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
            subject="Оплата получена",
            body=f"Заказ #{order.id} оплачен. Средства заморожены до получения товара.",
        ))
        db.commit()
        request.session["payment_success"] = f"Заказ #{order.id} оплачен"
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/{order_id}/complete")
def order_complete(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.delivery), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if order and is_order_receivable(order.status):
        from finance_ledger import release_escrow_for_order

        order.status = "completed"
        order.buyer_confirmed_at = datetime.utcnow()
        if order.delivery:
            order.delivery.status = "delivered"
        release_escrow_for_order(db, order, trigger="buyer_confirm")
        db.commit()

        db.add(Notification(
            user_id=order.user_id,
            type="email",
            subject="Заказ завершен",
            body=f"Заказ #{order.id} получен. Спасибо за покупку!",
        ))
        db.commit()
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/{order_id}/cancel")
def order_cancel(
    order_id: int,
    request: Request,
    cancel_reason: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.delivery))
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if not order:
        request.session["payment_error"] = "Заказ не найден."
        return RedirectResponse("/order/orders", status_code=303)

    ok, message = cancel_order(db, order, role="user", reason=cancel_reason, notify_user=False)
    if ok:
        db.commit()
    else:
        request.session["payment_error"] = message
    return RedirectResponse(f"/order/orders#order-{order_id}", status_code=303)


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
            f"В корзину добавлены товары из заказа #{order.id}. "
            f"Недоступные позиции пропущены: {visible_names}."
        )
    else:
        request.session["cart_success"] = f"Товары из заказа #{order.id} снова добавлены в корзину."

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
