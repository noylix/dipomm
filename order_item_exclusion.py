"""Исключение позиции из заказа после оформления (админ / продавец)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from marketplace_utils import effective_product_price, platform_commission_percent, product_stock_quantity
from email_utils import send_email, smtp_is_configured
from models import Notification, Order, OrderItem, User
from order_statuses import normalize_order_status
from payment_refunds import refund_channel_label, refund_order_payment_amount

TERMINAL_STATUSES = frozenset({"cancelled", "refunded", "completed", "received"})

ROLE_EXCLUDABLE_STATUSES: dict[str, frozenset[str]] = {
    "seller": frozenset({
        "created",
        "awaiting_payment",
        "payment_failed",
        "paid",
        "confirmed",
        "assembling",
        "ready_for_pickup",
        "ready_for_delivery",
    }),
    "admin": frozenset({
        "created",
        "awaiting_payment",
        "payment_failed",
        "paid",
        "confirmed",
        "assembling",
        "ready_for_pickup",
        "ready_for_delivery",
        "in_delivery",
    }),
}


def order_items_goods_subtotal(items: list[OrderItem]) -> Decimal:
    total = Decimal("0")
    for item in items:
        if item.product and item.quantity:
            total += Decimal(effective_product_price(item.product)) * int(item.quantity or 0)
    return total.quantize(Decimal("0.01"))


def can_exclude_order_item(
    order: Order,
    item: OrderItem,
    *,
    role: str,
    seller_id: int | None = None,
) -> tuple[bool, str]:
    status = normalize_order_status(order.status)
    if status in TERMINAL_STATUSES or status == "delivered":
        return False, "На этом этапе заказ уже нельзя изменить."

    allowed = ROLE_EXCLUDABLE_STATUSES.get(role)
    if not allowed:
        return False, "Недостаточно прав для исключения товара."
    if status not in allowed:
        return False, "На текущем этапе заказа товар нельзя исключить."

    active_items = [row for row in (order.items or []) if row.product]
    if len(active_items) <= 1:
        return False, "Нельзя исключить последний товар. Отмените заказ целиком."

    if role == "seller":
        if not item.product or item.product.owner_id != seller_id:
            return False, "Можно исключать только свои товары."
        foreign_items = [
            row for row in active_items
            if row.product and row.product.owner_id != seller_id
        ]
        if foreign_items:
            return False, "Заказ содержит товары других продавцов. Обратитесь к администратору."

    return True, ""


def recalculate_order_totals(order: Order, db: Session) -> None:
    items = (
        db.query(OrderItem)
        .options(joinedload(OrderItem.product))
        .filter(OrderItem.order_id == order.id)
        .all()
    )
    new_goods_subtotal = order_items_goods_subtotal(items)
    discount = Decimal(order.discount_amount or 0)
    if discount > new_goods_subtotal:
        discount = new_goods_subtotal
        order.discount_amount = discount

    goods_after_discount = (new_goods_subtotal - discount).quantize(Decimal("0.01"))
    commission_percent = platform_commission_percent(db)
    order.platform_fee = (goods_after_discount * commission_percent / Decimal("100")).quantize(Decimal("0.01"))
    order.total_price = (goods_after_discount + Decimal(order.delivery_fee or 0)).quantize(Decimal("0.01"))


def _notify_buyer_item_excluded(
    db: Session,
    order: Order,
    *,
    product_name: str,
    removed_qty: int,
    reason: str,
    new_total: Decimal,
    refund_note: str,
) -> None:
    if not order.user_id:
        return

    order_label = order.order_number or order.id
    subject = f"Товар «{product_name}» убран из заказа #{order_label}"
    body = (
        f"Из вашего заказа #{order_label} убран товар «{product_name}» ({removed_qty} шт.).\n\n"
        f"Причина: {reason}\n\n"
        f"Новая сумма заказа: {float(new_total):.2f} ₽."
    )
    if refund_note.strip():
        body += refund_note.strip()

    db.add(
        Notification(
            user_id=order.user_id,
            type="system",
            subject=subject,
            body=body,
            is_read=0,
        )
    )

    buyer = db.query(User).filter(User.id == order.user_id).first()
    if buyer and buyer.email and smtp_is_configured():
        try:
            send_email(buyer.email, subject, body)
        except Exception:
            pass


def exclude_order_item(
    db: Session,
    order: Order,
    item: OrderItem,
    *,
    role: str,
    reason: str,
    actor_user_id: int | None = None,
    seller_id: int | None = None,
) -> tuple[bool, str]:
    reason = (reason or "").strip()
    if len(reason) < 5:
        return False, "Укажите причину исключения (не короче 5 символов)."

    ok, message = can_exclude_order_item(order, item, role=role, seller_id=seller_id)
    if not ok:
        return False, message

    product = item.product
    product_name = product.name if product else "Товар"
    removed_qty = int(item.quantity or 0)
    old_total = Decimal(order.total_price or 0)
    old_goods = order_items_goods_subtotal([row for row in (order.items or []) if row.product])

    if product and item.quantity:
        product.stock = product_stock_quantity(product) + int(item.quantity or 0)

    db.delete(item)
    db.flush()
    db.expire(order, ["items"])

    remaining_items = (
        db.query(OrderItem)
        .options(joinedload(OrderItem.product))
        .filter(OrderItem.order_id == order.id)
        .all()
    )
    new_goods = order_items_goods_subtotal(remaining_items)
    if old_goods > 0 and Decimal(order.discount_amount or 0) > 0:
        ratio = new_goods / old_goods
        order.discount_amount = (Decimal(order.discount_amount or 0) * ratio).quantize(Decimal("0.01"))
    elif not remaining_items:
        order.discount_amount = Decimal("0")

    recalculate_order_totals(order, db)
    new_total = Decimal(order.total_price or 0)
    refund_amount = (old_total - new_total).quantize(Decimal("0.01"))

    refund_note = ""
    was_paid = order.payment_status == "paid"
    if was_paid and refund_amount > 0:
        refund_reason = reason or f"Исключение товара из заказа #{order.id}"
        ok_refund, refund_message, refunded = refund_order_payment_amount(db, order, refund_amount, refund_reason)
        if not ok_refund:
            return False, refund_message
        if refunded:
            order.payment_amount = new_total
            refund_note = f" Возвращено {float(refund_amount):.2f} ₽ {refund_channel_label(order)}."
        elif refund_message:
            refund_note = f" {refund_message}"

    _notify_buyer_item_excluded(
        db,
        order,
        product_name=product_name,
        removed_qty=removed_qty,
        reason=reason,
        new_total=new_total,
        refund_note=refund_note,
    )

    success = f"Товар «{product_name}» исключён из заказа. Новая сумма: {float(new_total):.2f} ₽."
    if refund_note.strip():
        success += refund_note.strip()
    return True, success
