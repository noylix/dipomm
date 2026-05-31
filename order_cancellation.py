"""Общая логика отмены заказов для покупателя, продавца и администратора."""

from __future__ import annotations

from sqlalchemy.orm import Session

from marketplace_utils import product_stock_quantity
from models import Notification, Order
from order_statuses import normalize_order_status
from payment_refunds import refund_channel_label, refund_order_payment

TERMINAL_STATUSES = frozenset({"cancelled", "refunded", "completed", "received"})

ROLE_CANCELLABLE_STATUSES: dict[str, frozenset[str]] = {
    "user": frozenset({"created", "awaiting_payment", "payment_failed", "paid", "confirmed"}),
    "seller": frozenset({"awaiting_payment", "created", "paid", "confirmed", "assembling"}),
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


def can_cancel_order(order: Order, role: str) -> tuple[bool, str]:
    status = normalize_order_status(order.status)
    if status in TERMINAL_STATUSES:
        return False, "Заказ уже завершён или отменён."
    allowed = ROLE_CANCELLABLE_STATUSES.get(role)
    if not allowed:
        return False, "Недостаточно прав для отмены заказа."
    if status not in allowed:
        return False, "На этом этапе заказ нельзя отменить."
    return True, ""


def restore_order_stock(order: Order) -> None:
    for item in order.items or []:
        if item.product and item.quantity:
            item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)


def cancel_order(
    db: Session,
    order: Order,
    *,
    role: str,
    reason: str = "",
    notify_user: bool = True,
) -> tuple[bool, str]:
    ok, message = can_cancel_order(order, role)
    if not ok:
        return False, message

    reason = (reason or "").strip()
    if role == "seller" and len(reason) < 5:
        return False, "Укажите причину отмены заказа (не короче 5 символов)."

    was_paid = order.payment_status == "paid"
    if was_paid:
        refund_reason = reason or {
            "user": f"Отмена заказа покупателем #{order.id}",
            "seller": f"Отмена заказа продавцом #{order.id}",
            "admin": f"Отмена заказа администратором #{order.id}",
        }.get(role, f"Отмена заказа #{order.id}")
        ok, refund_message, refunded = refund_order_payment(db, order, refund_reason)
        if not ok:
            return False, refund_message
    else:
        refund_message = ""
        refunded = False

    order.status = "cancelled"
    if not was_paid and (order.payment_status or "pending") == "pending":
        order.payment_status = "cancelled"

    if role == "seller":
        order.return_reason = "Отменено продавцом"
        order.seller_cancel_reason = reason
    elif role == "user":
        order.return_reason = f"Отменено покупателем: {reason}" if reason else "Отменено покупателем"
    elif role == "admin":
        order.return_reason = f"Отменено администратором: {reason}" if reason else "Отменено администратором"
        if reason:
            order.seller_cancel_reason = reason

    restore_order_stock(order)
    delivery = order.delivery
    if delivery:
        delivery.status = "cancelled"

    if notify_user:
        actor_label = {"user": "Покупатель", "seller": "Продавец", "admin": "Администратор"}.get(role, "Система")
        body = f"{actor_label} отменил заказ #{order.id}."
        if reason:
            body += f" Причина: {reason}"
        if was_paid and refunded:
            body += f" Оплата будет возвращена {refund_channel_label(order)}."
        elif was_paid and refund_message:
            body += f" {refund_message}"
        db.add(
            Notification(
                user_id=order.user_id,
                type="system",
                subject=f"Заказ #{order.id} отменён",
                body=body,
            )
        )

    success = "Заказ отменён."
    if was_paid and refunded:
        success += f" Оплата возвращена {refund_channel_label(order)}."
    elif was_paid and refund_message:
        success += f" {refund_message}"
    return True, success
