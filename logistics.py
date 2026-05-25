import hashlib
from datetime import datetime

from models import Delivery, Order


LOGISTICS_BY_METHOD = {
    "courier": {
        "provider": "FreshRoute Logistics",
        "prefix": "FR",
        "status": "accepted",
    },
    "post": {
        "provider": "FarmBox Delivery",
        "prefix": "FB",
        "status": "accepted",
    },
    "market": {
        "provider": "MarketPoint Logistics",
        "prefix": "MP",
        "status": "accepted",
    },
}


def _shipment_suffix(order: Order) -> str:
    source = f"{order.id}:{order.order_number or ''}:{order.created_at or datetime.utcnow()}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()[:8].upper()


def ensure_logistics_shipment(order: Order) -> Delivery | None:
    delivery = order.delivery
    if not delivery:
        return None

    method = (order.delivery_method or delivery.method or "courier").strip()
    config = LOGISTICS_BY_METHOD.get(method)
    if not config:
        delivery.status = delivery.status or "manual"
        return delivery

    if not delivery.track_number:
        suffix = _shipment_suffix(order)
        delivery.provider = config["provider"]
        delivery.external_id = f"{config['prefix']}-{order.id}-{suffix}"
        delivery.track_number = f"{config['prefix']}{order.id:06d}{suffix[:4]}"
        delivery.tracking_url = f"/delivery/track/{delivery.track_number}"

    delivery.status = config["status"]
    return delivery


def mark_shipment_in_transit(order: Order) -> Delivery | None:
    delivery = ensure_logistics_shipment(order)
    if delivery:
        delivery.status = "in_transit"
    return delivery
