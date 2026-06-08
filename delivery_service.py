from datetime import datetime
from decimal import Decimal

from models import Delivery, Order, User


DELIVERY_METHODS = {"pickup", "farmer_delivery", "partner_delivery"}
LEGACY_DELIVERY_METHOD_MAP = {
    "courier": "farmer_delivery",
    "post": "partner_delivery",
    "market": "pickup",
}
DELIVERY_SLOTS = {
    "10-14": ("10:00", "14:00"),
    "14-18": ("14:00", "18:00"),
    "18-22": ("18:00", "22:00"),
}


def normalize_delivery_method(method: str | None) -> str:
    value = (method or "pickup").strip()
    return LEGACY_DELIVERY_METHOD_MAP.get(value, value)


def delivery_label(method: str) -> str:
    return {
        "farmer_delivery": "Доставка фермером",
        "partner_delivery": "Партнёрская доставка",
        "courier": "Доставка фермером",
        "pickup": "Самовывоз",
        "post": "Партнёрская доставка",
        "market": "Самовывоз",
    }.get(method, method)


def seller_slots(seller: User | None) -> list[str]:
    raw = (getattr(seller, "delivery_slots", None) or "10-14,14-18,18-22").strip()
    slots = [slot.strip() for slot in raw.replace(";", ",").split(",") if slot.strip() in DELIVERY_SLOTS]
    return slots or list(DELIVERY_SLOTS)


def seller_minimum(seller: User | None, base_minimum: Decimal, method: str | None = None) -> Decimal:
    base = max(Decimal(str((seller.min_order_amount if seller else 0) or 0)), base_minimum)
    if method == "farmer_delivery" and seller:
        delivery_min = Decimal(str(seller.farmer_delivery_min_order or 0))
        return max(base, delivery_min)
    return base


def seller_pickup_address(seller: User | None) -> str:
    if not seller:
        return ""
    return (seller.pickup_address or seller.farm_address or "").strip()


def seller_delivery_options(seller: User | None, base_minimum: Decimal) -> list[dict[str, object]]:
    if not seller:
        return []
    options: list[dict[str, object]] = []
    pickup_address = seller_pickup_address(seller)
    if int(seller.pickup_enabled or 0):
        options.append({
            "method": "pickup",
            "label": "Самовывоз",
            "fee": 0.0,
            "requires_address": False,
            "address": pickup_address,
            "pickup_address": pickup_address,
            "comment": seller.pickup_comment or "",
        })
    if int(seller.farmer_delivery_enabled or 0):
        options.append({
            "method": "farmer_delivery",
            "label": "Доставка фермером",
            "fee": float(seller.farmer_delivery_fee or 0),
            "requires_address": True,
            "min_order": float(seller_minimum(seller, base_minimum, "farmer_delivery")),
            "comment": seller.farmer_delivery_comment or "",
        })
    if int(seller.partner_delivery_enabled or 0):
        options.append({
            "method": "partner_delivery",
            "label": "Партнёрская доставка",
            "fee": float(seller.partner_delivery_fee or 0),
            "requires_address": True,
            "comment": seller.partner_delivery_comment or "Учебный режим партнёрской доставки без реального API.",
        })
    return options


def delivery_option(seller: User | None, method: str, base_minimum: Decimal) -> dict[str, object] | None:
    normalized = normalize_delivery_method(method)
    for option in seller_delivery_options(seller, base_minimum):
        if option["method"] == normalized:
            return option
    return None


def demo_track_number(order_id: int) -> str:
    return f"FD-{datetime.utcnow():%Y}-{order_id:06d}"


def create_order_delivery(
    order: Order,
    method: str,
    address: str | None,
    parsed_date: datetime,
    slot: str,
    comment: str | None,
    delivery_fee: Decimal,
    seller: User | None,
) -> Delivery:
    normalized = normalize_delivery_method(method)
    delivery = Delivery(
        order_id=order.id,
        address=address or None,
        method=normalized,
        status="waiting_payment",
        delivery_date=parsed_date,
        delivery_slot=slot,
        comment=comment or None,
        delivery_fee=delivery_fee,
    )
    if normalized == "pickup":
        delivery.address = seller_pickup_address(seller) or None
    elif normalized == "partner_delivery":
        delivery.provider = "Демо-партнёр доставки"
        delivery.provider_name = "Демо-партнёр доставки"
        delivery.track_number = demo_track_number(order.id)
        delivery.tracking_url = f"/delivery/track/{delivery.track_number}"
        delivery.external_id = delivery.track_number
    return delivery
