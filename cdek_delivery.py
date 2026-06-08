import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime
from urllib import parse, request

from models import Order


CDEK_DELIVERY_METHODS = {"partner_delivery", "post"}
CDEK_PROVIDER_NAME = "\u0421\u0414\u042d\u041a (\u0442\u0435\u0441\u0442)"
CDEK_TRACK_PREFIX = "CDEK"
CDEK_TEST_STATUS = "accepted"
CDEK_API_BASE_URL = os.getenv("CDEK_API_BASE_URL", "https://api.edu.cdek.ru/v2").rstrip("/")
CDEK_ACCOUNT = os.getenv("CDEK_ACCOUNT", "")
CDEK_SECURE_PASSWORD = os.getenv("CDEK_SECURE_PASSWORD", "")


@dataclass(frozen=True)
class CdekDeliveryShipment:
    provider: str
    external_id: str
    track_number: str
    tracking_url: str
    status: str


def _shipment_suffix(order: Order) -> str:
    source = f"{order.id}:{order.order_number or ''}:{order.created_at or datetime.utcnow()}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()[:8].upper()


def is_cdek_delivery_method(method: str | None) -> bool:
    return (method or "").strip() in CDEK_DELIVERY_METHODS


def create_test_cdek_shipment(order: Order) -> CdekDeliveryShipment:
    suffix = _shipment_suffix(order)
    track_number = f"{CDEK_TRACK_PREFIX}{order.id:06d}{suffix[:4]}"
    return CdekDeliveryShipment(
        provider=CDEK_PROVIDER_NAME,
        external_id=f"CDEK-TEST-{order.id}-{suffix}",
        track_number=track_number,
        tracking_url=f"/delivery/track/{track_number}",
        status=CDEK_TEST_STATUS,
    )


def cdek_credentials_configured() -> bool:
    return bool(os.getenv("CDEK_ACCOUNT", CDEK_ACCOUNT) and os.getenv("CDEK_SECURE_PASSWORD", CDEK_SECURE_PASSWORD))


def fetch_cdek_access_token(timeout: int = 10) -> str:
    api_base_url = os.getenv("CDEK_API_BASE_URL", CDEK_API_BASE_URL).rstrip("/")
    account = os.getenv("CDEK_ACCOUNT", CDEK_ACCOUNT)
    secure_password = os.getenv("CDEK_SECURE_PASSWORD", CDEK_SECURE_PASSWORD)
    if not cdek_credentials_configured():
        raise RuntimeError("CDEK credentials are not configured")

    payload = parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": account,
        "client_secret": secure_password,
    }).encode("utf-8")
    token_request = request.Request(
        f"{api_base_url}/oauth/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with request.urlopen(token_request, timeout=timeout) as response:
        data = json.loads(response.read().decode("utf-8"))
    token = data.get("access_token")
    if not token:
        raise RuntimeError("CDEK token response does not contain access_token")
    return str(token)
