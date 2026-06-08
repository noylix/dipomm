import hashlib
from dataclasses import dataclass
from datetime import datetime

from models import Order


YANDEX_DELIVERY_METHODS = {"partner_delivery", "post"}
YANDEX_PROVIDER_NAME = "Яндекс Доставка (тест)"
YANDEX_TRACK_PREFIX = "YM"
YANDEX_TEST_STATUS = "accepted"


@dataclass(frozen=True)
class YandexDeliveryShipment:
    provider: str
    external_id: str
    track_number: str
    tracking_url: str
    status: str


def _shipment_suffix(order: Order) -> str:
    source = f"{order.id}:{order.order_number or ''}:{order.created_at or datetime.utcnow()}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()[:8].upper()


def is_yandex_delivery_method(method: str | None) -> bool:
    return (method or "").strip() in YANDEX_DELIVERY_METHODS


def create_test_yandex_shipment(order: Order) -> YandexDeliveryShipment:
    suffix = _shipment_suffix(order)
    track_number = f"{YANDEX_TRACK_PREFIX}{order.id:06d}{suffix[:4]}"
    return YandexDeliveryShipment(
        provider=YANDEX_PROVIDER_NAME,
        external_id=f"YANDEX-TEST-{order.id}-{suffix}",
        track_number=track_number,
        tracking_url=f"/delivery/track/{track_number}",
        status=YANDEX_TEST_STATUS,
    )
