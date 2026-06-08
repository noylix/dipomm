import hashlib
import json
import os
import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from urllib import error, parse, request

from models import Order, Product


CDEK_DELIVERY_METHODS = {"partner_delivery", "post"}
CDEK_PROVIDER_NAME = "\u0421\u0414\u042d\u041a"
CDEK_LEGACY_PROVIDER_NAMES = {"\u0421\u0414\u042d\u041a (\u0442\u0435\u0441\u0442)"}
CDEK_TRACK_PREFIX = "CDEK"
CDEK_TEST_STATUS = "accepted"
CDEK_API_BASE_URL = os.getenv("CDEK_API_BASE_URL", "https://api.edu.cdek.ru/v2").rstrip("/")
CDEK_ACCOUNT = os.getenv("CDEK_ACCOUNT", "")
CDEK_SECURE_PASSWORD = os.getenv("CDEK_SECURE_PASSWORD", "")
CDEK_FROM_CITY_CODE = int(os.getenv("CDEK_FROM_CITY_CODE", "44") or 44)
CDEK_DEFAULT_TARIFF_PICKUP = int(os.getenv("CDEK_TARIFF_PICKUP", "136") or 136)
CDEK_DEFAULT_TARIFF_DOOR = int(os.getenv("CDEK_TARIFF_DOOR", "137") or 137)
CDEK_DEFAULT_PACKAGE_LENGTH = int(os.getenv("CDEK_PACKAGE_LENGTH_CM", "20") or 20)
CDEK_DEFAULT_PACKAGE_WIDTH = int(os.getenv("CDEK_PACKAGE_WIDTH_CM", "20") or 20)
CDEK_DEFAULT_PACKAGE_HEIGHT = int(os.getenv("CDEK_PACKAGE_HEIGHT_CM", "20") or 20)
CDEK_DEFAULT_ITEM_WEIGHT_GRAMS = int(os.getenv("CDEK_DEFAULT_ITEM_WEIGHT_GRAMS", "500") or 500)


@dataclass(frozen=True)
class CdekDeliveryShipment:
    provider: str
    external_id: str
    track_number: str
    tracking_url: str
    status: str


@dataclass(frozen=True)
class CdekDeliveryQuote:
    delivery_sum: Decimal
    tariff_code: int
    delivery_type: str
    period_min: int | None = None
    period_max: int | None = None


@dataclass(frozen=True)
class CdekOrderRegistration:
    uuid: str
    cdek_number: str | None
    status: str


def _shipment_suffix(order: Order) -> str:
    source = f"{order.id}:{order.order_number or ''}:{order.created_at or datetime.utcnow()}"
    return hashlib.sha1(source.encode("utf-8")).hexdigest()[:8].upper()


def is_cdek_delivery_method(method: str | None) -> bool:
    return (method or "").strip() in CDEK_DELIVERY_METHODS


def is_cdek_provider(provider: str | None) -> bool:
    return (provider or "").strip() in {CDEK_PROVIDER_NAME, *CDEK_LEGACY_PROVIDER_NAMES}


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


def _api_base_url() -> str:
    return os.getenv("CDEK_API_BASE_URL", CDEK_API_BASE_URL).rstrip("/")


def _authorized_request(path: str, method: str = "GET", payload: dict | None = None, timeout: int = 15):
    token = fetch_cdek_access_token(timeout=timeout)
    data = None
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    api_request = request.Request(
        f"{_api_base_url()}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with request.urlopen(api_request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"CDEK API returned {exc.code}: {body}") from exc
    return json.loads(raw) if raw else {}


def search_cdek_cities(city: str, limit: int = 8) -> list[dict[str, object]]:
    city = (city or "").strip()
    if len(city) < 2:
        return []
    query = parse.urlencode({"city": city, "country_codes": "RU", "size": str(max(1, min(limit, 20)))})
    rows = _authorized_request(f"/location/cities?{query}", timeout=12)
    return [
        {
            "code": row.get("code"),
            "city": row.get("city"),
            "region": row.get("region"),
            "country": row.get("country"),
        }
        for row in rows
        if row.get("code") and row.get("city")
    ]


def fetch_cdek_delivery_points(city_code: int, limit: int = 20) -> list[dict[str, object]]:
    query = parse.urlencode({"city_code": int(city_code), "type": "PVZ", "size": str(max(1, min(limit, 50)))})
    rows = _authorized_request(f"/deliverypoints?{query}", timeout=15)
    return [
        {
            "code": row.get("code"),
            "name": row.get("name"),
            "address": row.get("location", {}).get("address_full") or row.get("location", {}).get("address"),
            "work_time": row.get("work_time"),
        }
        for row in rows
        if row.get("code")
    ]


def _grams_from_weight_per_unit(value: str | None) -> int:
    text = (value or "").strip().lower().replace(",", ".")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|g)", text)
    if not match:
        return CDEK_DEFAULT_ITEM_WEIGHT_GRAMS
    amount = Decimal(match.group(1))
    unit = match.group(2)
    grams = amount * (Decimal("1000") if unit in {"кг", "kg"} else Decimal("1"))
    return max(1, int(grams.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def product_weight_grams(product: Product | None) -> int:
    if not product:
        return CDEK_DEFAULT_ITEM_WEIGHT_GRAMS
    return _grams_from_weight_per_unit(product.weight_per_unit)


def cdek_packages_for_items(items) -> list[dict[str, object]]:
    total_weight = 0
    package_items = []
    for order_or_cart_item in items or []:
        product = getattr(order_or_cart_item, "product", None)
        quantity = int(getattr(order_or_cart_item, "quantity", 0) or 0)
        if not product or quantity <= 0:
            continue
        item_weight = product_weight_grams(product)
        total_weight += item_weight * quantity
        package_items.append({
            "name": (product.name or f"Товар #{product.id}")[:255],
            "ware_key": str(product.id),
            "payment": {"value": 0},
            "cost": float(Decimal(product.price or 0)),
            "weight": item_weight,
            "amount": quantity,
        })
    return [{
        "number": "1",
        "weight": max(total_weight, CDEK_DEFAULT_ITEM_WEIGHT_GRAMS),
        "length": CDEK_DEFAULT_PACKAGE_LENGTH,
        "width": CDEK_DEFAULT_PACKAGE_WIDTH,
        "height": CDEK_DEFAULT_PACKAGE_HEIGHT,
        "items": package_items,
    }]


def cdek_tariff_code(delivery_type: str) -> int:
    return CDEK_DEFAULT_TARIFF_DOOR if delivery_type == "door" else CDEK_DEFAULT_TARIFF_PICKUP


def cdek_order_status(entity: dict[str, object]) -> str:
    statuses = entity.get("statuses") or []
    if isinstance(statuses, list) and statuses:
        active_statuses = [status for status in statuses if isinstance(status, dict) and not status.get("deleted")]
        latest_status = active_statuses[-1] if active_statuses else statuses[-1]
        if isinstance(latest_status, dict):
            return str(latest_status.get("code") or latest_status.get("name") or "")
    return str(entity.get("status") or "")


def calculate_cdek_delivery_quote(
    items,
    to_city_code: int,
    delivery_type: str = "pickup",
) -> CdekDeliveryQuote:
    delivery_type = "door" if delivery_type == "door" else "pickup"
    tariff_code = cdek_tariff_code(delivery_type)
    payload = {
        "type": 1,
        "tariff_code": tariff_code,
        "from_location": {"code": CDEK_FROM_CITY_CODE},
        "to_location": {"code": int(to_city_code)},
        "packages": cdek_packages_for_items(items),
    }
    data = _authorized_request("/calculator/tariff", method="POST", payload=payload, timeout=20)
    delivery_sum = Decimal(str(data.get("delivery_sum") or data.get("total_sum") or 0)).quantize(Decimal("0.01"))
    if delivery_sum <= 0:
        raise RuntimeError("CDEK did not return delivery_sum")
    return CdekDeliveryQuote(
        delivery_sum=delivery_sum,
        tariff_code=int(data.get("tariff_code") or tariff_code),
        delivery_type=delivery_type,
        period_min=data.get("period_min"),
        period_max=data.get("period_max"),
    )


def _phone_number(order: Order) -> str:
    phone = re.sub(r"\D+", "", order.customer_phone or (order.user.phone if order.user else "") or "")
    if phone.startswith("8") and len(phone) == 11:
        phone = f"7{phone[1:]}"
    if len(phone) == 10:
        phone = f"7{phone}"
    return f"+{phone}" if phone else "+79990000000"


def create_cdek_order(
    order: Order,
    to_city_code: int,
    delivery_type: str,
    delivery_point: str | None = None,
    address: str | None = None,
) -> CdekOrderRegistration:
    delivery_type = "door" if delivery_type == "door" else "pickup"
    payload = {
        "type": 1,
        "number": order.order_number or str(order.id),
        "tariff_code": cdek_tariff_code(delivery_type),
        "comment": (order.customer_comment or "Заказ Свои Ряды")[:255],
        "from_location": {"code": CDEK_FROM_CITY_CODE},
        "recipient": {
            "name": (order.customer_name or "Покупатель")[:255],
            "phones": [{"number": _phone_number(order)}],
        },
        "sender": {"name": "Свои Ряды"},
        "packages": cdek_packages_for_items(order.items),
    }
    if delivery_type == "pickup":
        if not delivery_point:
            raise RuntimeError("CDEK pickup point is required")
        payload["delivery_point"] = delivery_point.strip()
    else:
        if not address:
            raise RuntimeError("CDEK recipient address is required")
        payload["to_location"] = {"code": int(to_city_code), "address": address.strip()}

    data = _authorized_request("/orders", method="POST", payload=payload, timeout=25)
    entity = data.get("entity") or data
    uuid = entity.get("uuid") or data.get("uuid")
    if not uuid:
        raise RuntimeError("CDEK order response does not contain uuid")
    return CdekOrderRegistration(
        uuid=str(uuid),
        cdek_number=entity.get("cdek_number") or entity.get("number"),
        status=cdek_order_status(entity) or "created",
    )


def fetch_cdek_order(uuid_or_cdek_number: str) -> dict[str, object]:
    value = (uuid_or_cdek_number or "").strip()
    if not value:
        raise RuntimeError("CDEK order identifier is empty")
    if "-" in value:
        data = _authorized_request(f"/orders/{parse.quote(value)}", timeout=15)
    else:
        data = _authorized_request(f"/orders?{parse.urlencode({'cdek_number': value})}", timeout=15)
    return data.get("entity") or data
