from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from marketplace_utils import effective_product_price
from models import CartItem, Coupon, User

COUPON_CODE_RE = re.compile(r"^[A-Z0-9_-]{3,50}$")


def normalize_coupon_code(code: str | None) -> str:
    return (code or "").strip().upper()


def parse_coupon_date_start(value: str) -> datetime | None:
    try:
        parsed = datetime.strptime(value.strip(), "%Y-%m-%d")
        return parsed.replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        return None


def parse_coupon_date_end(value: str) -> datetime | None:
    try:
        parsed = datetime.strptime(value.strip(), "%Y-%m-%d")
        return parsed.replace(hour=23, minute=59, second=59, microsecond=0)
    except ValueError:
        return None


def coupon_is_active_now(coupon: Coupon | None, now: datetime | None = None) -> bool:
    if not coupon or int(coupon.is_active or 0) != 1:
        return False
    now = now or datetime.now()
    if coupon.valid_from and coupon.valid_from > now:
        return False
    if coupon.valid_to and coupon.valid_to < now:
        return False
    if coupon.max_uses is not None and int(coupon.usage_count or 0) >= int(coupon.max_uses):
        return False
    return True


def serialize_coupon(coupon: Coupon) -> dict[str, object]:
    return {
        "id": coupon.id,
        "code": coupon.code,
        "title": coupon.title or "",
        "discount_percent": int(coupon.discount_percent or 0),
        "min_order": float(coupon.min_order or 0),
        "valid_from": coupon.valid_from.isoformat() if coupon.valid_from else None,
        "valid_to": coupon.valid_to.isoformat() if coupon.valid_to else None,
        "is_active": int(coupon.is_active or 0),
        "usage_count": int(coupon.usage_count or 0),
        "max_uses": coupon.max_uses,
    }


def cart_seller_subtotals(db: Session, user_id: int) -> dict[int, Decimal]:
    items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == user_id)
        .all()
    )
    subtotals: dict[int, Decimal] = {}
    for item in items:
        product = item.product
        if not product or product.status != "approved":
            continue
        seller_id = product.owner_id
        line_total = Decimal(effective_product_price(product)) * int(item.quantity or 0)
        subtotals[seller_id] = subtotals.get(seller_id, Decimal("0")) + line_total
    return subtotals


def evaluate_coupon(
    db: Session,
    code: str | None,
    seller_subtotals: dict[int, Decimal],
) -> tuple[Coupon | None, Decimal, str | None]:
    normalized = normalize_coupon_code(code)
    if not normalized:
        return None, Decimal("0"), None

    coupon = db.query(Coupon).filter(Coupon.code == normalized).first()
    if not coupon:
        return None, Decimal("0"), "Промокод не найден."

    if not coupon_is_active_now(coupon):
        return None, Decimal("0"), "Промокод неактивен или срок его действия истёк."

    total_subtotal = sum(seller_subtotals.values(), Decimal("0"))
    min_order = Decimal(coupon.min_order or 0)
    percent = Decimal(int(coupon.discount_percent or 0))

    if coupon.seller_id:
        eligible = seller_subtotals.get(int(coupon.seller_id), Decimal("0"))
        if eligible <= 0:
            return None, Decimal("0"), "Промокод действует только на товары этого фермера. Добавьте их в корзину."
        if eligible < min_order:
            return None, Decimal("0"), f"Минимальная сумма для промокода — {float(min_order):.0f} ₽ по товарам фермера."
        discount = (eligible * percent / Decimal("100")).quantize(Decimal("0.01"))
        return coupon, discount, None

    if total_subtotal < min_order:
        return None, Decimal("0"), "Промокод не подходит для этой суммы заказа."
    discount = (total_subtotal * percent / Decimal("100")).quantize(Decimal("0.01"))
    return coupon, discount, None


def group_discounts(
    coupon: Coupon | None,
    group_payloads: list[dict[str, object]],
    discount_amount: Decimal,
) -> dict[int | None, Decimal]:
    empty = {group["seller_id"]: Decimal("0") for group in group_payloads}
    if not coupon or discount_amount <= 0:
        return empty

    if coupon.seller_id:
        result = dict(empty)
        result[int(coupon.seller_id)] = discount_amount
        return result

    subtotal = sum(Decimal(str(group["subtotal"])) for group in group_payloads)
    if subtotal <= 0:
        return empty

    result: dict[int | None, Decimal] = {}
    assigned = Decimal("0")
    for index, group in enumerate(group_payloads):
        seller_id = group["seller_id"]
        if index == len(group_payloads) - 1:
            result[seller_id] = discount_amount - assigned
        else:
            part = (discount_amount * Decimal(str(group["subtotal"])) / subtotal).quantize(Decimal("0.01"))
            result[seller_id] = part
            assigned += part
    return result


def coupon_applies_to_group(coupon: Coupon | None, seller_id: int | None) -> bool:
    if not coupon:
        return False
    if coupon.seller_id:
        return int(coupon.seller_id) == int(seller_id or 0)
    return True


def preview_coupon_message(coupon: Coupon, discount: Decimal, seller: User | None = None) -> str:
    if coupon.seller_id and seller:
        seller_name = seller.farm_name or seller.full_name or "фермера"
        return f"Скидка {coupon.discount_percent}% на товары {seller_name}: −{float(discount):.2f} ₽"
    return f"Скидка {coupon.discount_percent}%: −{float(discount):.2f} ₽"
