ORDER_STATUSES = [
    "created",
    "confirmed",
    "paid",
    "assembling",
    "shipped",
    "delivering",
    "completed",
    "canceled",
    "refunded",
]

LEGACY_ORDER_STATUS_MAP = {
    "new": "created",
    "processing": "assembling",
    "cancelled": "canceled",
}

ORDER_STATUS_LABELS = {
    "created": "Создан",
    "confirmed": "Подтвержден",
    "paid": "Оплачен",
    "assembling": "Собирается",
    "shipped": "Передан в доставку",
    "delivering": "Доставляется",
    "completed": "Завершен",
    "canceled": "Отменен",
    "refunded": "Возврат",
    "new": "Создан",
    "processing": "Собирается",
    "cancelled": "Отменен",
}

ORDER_STATUS_BADGES = {
    "created": "fg-badge-info",
    "confirmed": "fg-badge-info",
    "paid": "fg-badge-success",
    "assembling": "fg-badge-warn",
    "shipped": "fg-badge-info",
    "delivering": "fg-badge-info",
    "completed": "fg-badge-success",
    "canceled": "fg-badge-danger",
    "refunded": "fg-badge-danger",
    "new": "fg-badge-info",
    "processing": "fg-badge-warn",
    "cancelled": "fg-badge-danger",
}


def normalize_order_status(status: str | None) -> str:
    if not status:
        return "created"
    return LEGACY_ORDER_STATUS_MAP.get(status, status)


def is_valid_order_status(status: str | None) -> bool:
    return normalize_order_status(status) in ORDER_STATUSES
