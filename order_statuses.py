ORDER_STATUSES = [
    "created",
    "awaiting_payment",
    "paid",
    "confirmed",
    "assembling",
    "ready_for_pickup",
    "ready_for_delivery",
    "in_delivery",
    "delivered",
    "received",
    "completed",
    "cancelled",
    "payment_failed",
    "refunded",
]

DELIVERY_STATUSES = [
    "created",
    "waiting_payment",
    "waiting_assembly",
    "ready_for_pickup",
    "ready_for_delivery",
    "transferred_to_delivery",
    "in_transit",
    "delivered",
    "cancelled",
]

PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled", "refunded"]

LEGACY_ORDER_STATUS_MAP = {
    "new": "created",
    "processing": "assembling",
    "canceled": "cancelled",
    "cancelled": "cancelled",
    "shipped": "ready_for_delivery",
    "delivering": "in_delivery",
}

ORDER_STATUS_LABELS = {
    "created": "Создан",
    "awaiting_payment": "Ожидает оплаты",
    "paid": "Оплачен",
    "confirmed": "Подтверждён",
    "assembling": "Собирается",
    "ready_for_pickup": "Готов к выдаче",
    "ready_for_delivery": "Готов к доставке",
    "in_delivery": "В доставке",
    "delivered": "Доставлен",
    "received": "Получен",
    "completed": "Завершён",
    "cancelled": "Отменён",
    "payment_failed": "Ошибка оплаты",
    "refunded": "Возврат",
    "new": "Создан",
    "processing": "Собирается",
    "canceled": "Отменён",
    "shipped": "Готов к доставке",
    "delivering": "В доставке",
}

DELIVERY_STATUS_LABELS = {
    "created": "Создана",
    "waiting_payment": "Ожидает оплаты",
    "waiting_assembly": "Ожидает сборки",
    "ready_for_pickup": "Готова к самовывозу",
    "ready_for_delivery": "Готова к доставке",
    "transferred_to_delivery": "Передана в доставку",
    "in_transit": "В пути",
    "delivered": "Доставлена",
    "cancelled": "Отменена",
}

ORDER_STATUS_BADGES = {
    "created": "fg-badge-info",
    "awaiting_payment": "fg-badge-warn",
    "paid": "fg-badge-success",
    "confirmed": "fg-badge-success",
    "assembling": "fg-badge-warn",
    "ready_for_pickup": "fg-badge-info",
    "ready_for_delivery": "fg-badge-info",
    "in_delivery": "fg-badge-info",
    "delivered": "fg-badge-success",
    "received": "fg-badge-success",
    "completed": "fg-badge-success",
    "cancelled": "fg-badge-danger",
    "payment_failed": "fg-badge-danger",
    "refunded": "fg-badge-danger",
}


def normalize_order_status(status: str | None) -> str:
    if not status:
        return "created"
    return LEGACY_ORDER_STATUS_MAP.get(status, status)


def is_valid_order_status(status: str | None) -> bool:
    return normalize_order_status(status) in ORDER_STATUSES


def is_order_payable(status: str | None, payment_status: str | None) -> bool:
    return normalize_order_status(status) in {"created", "awaiting_payment", "payment_failed"} and (payment_status or "pending") == "pending"


def is_order_receivable(status: str | None) -> bool:
    return normalize_order_status(status) in {"ready_for_pickup", "delivered"}


def delivery_status_after_payment(method: str | None) -> str:
    return "waiting_assembly"


def delivery_ready_status(method: str | None) -> str:
    if method == "pickup":
        return "ready_for_pickup"
    if method == "partner_delivery":
        return "transferred_to_delivery"
    return "ready_for_delivery"
