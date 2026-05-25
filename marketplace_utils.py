from __future__ import annotations

import re
from decimal import Decimal

from sqlalchemy import and_, case, or_


SMART_SEARCH_SYNONYMS: dict[str, list[str]] = {
    "молочка": ["молоко", "сыр", "творог", "сметана", "кефир"],
    "молочное": ["молоко", "сыр", "творог", "сметана", "кефир"],
    "молочные": ["молоко", "сыр", "творог", "сметана", "кефир"],
    "овощи": ["картофель", "помидоры", "огурцы", "морковь", "капуста", "зелень"],
    "овощ": ["картофель", "помидоры", "огурцы", "морковь", "капуста", "зелень"],
    "фрукты": ["яблоки", "груши", "ягоды"],
    "фрукт": ["яблоки", "груши", "ягоды"],
    "кчаю": ["мед", "варенье", "выпечка", "ягоды"],
    "чай": ["мед", "варенье", "выпечка", "ягоды"],
    "завтрак": ["яйца", "молоко", "сыр", "творог", "хлеб"],
    "завтраку": ["яйца", "молоко", "сыр", "творог", "хлеб"],
    "натуральное": ["фермерское", "домашнее", "органическое", "эко"],
    "фермерское": ["натуральное", "домашнее", "органическое", "эко"],
    "домашнее": ["натуральное", "фермерское", "органическое", "эко"],
    "эко": ["натуральное", "фермерское", "домашнее", "органическое"],
    "органическое": ["натуральное", "фермерское", "домашнее", "эко"],
}

TOKEN_RE = re.compile(r"[A-Za-z\u0400-\u04FF0-9]+")
MIN_ORDER_AMOUNT = Decimal("3000")


def normalize_text(value: str | None) -> str:
    return (value or "").strip().lower().replace("ё", "е")


def compact_text(value: str | None) -> str:
    return re.sub(r"[^a-zа-я0-9]+", "", normalize_text(value))


def tokenize_text(value: str | None) -> list[str]:
    tokens: list[str] = []
    for token in TOKEN_RE.findall(value or ""):
        normalized = compact_text(token)
        if len(normalized) >= 2:
            tokens.append(normalized)
    return tokens


def expand_search_terms(raw_query: str | None) -> list[str]:
    query = normalize_text(raw_query)
    if not query:
        return []

    compact_query = compact_text(query)
    terms: list[str] = []
    seen: set[str] = set()

    def add_term(value: str | None) -> None:
        normalized = compact_text(value)
        if normalized and len(normalized) >= 2 and normalized not in seen:
            seen.add(normalized)
            terms.append(normalized)

    for token in tokenize_text(query):
        add_term(token)

    add_term(query)

    for key, values in SMART_SEARCH_SYNONYMS.items():
        if compact_query == key or compact_query.startswith(key) or key.startswith(compact_query):
            add_term(key)
            for value in values:
                add_term(value)

    for token in list(terms):
        for value in SMART_SEARCH_SYNONYMS.get(token, []):
            add_term(value)

    return terms


def search_variants(value: str | None) -> set[str]:
    """Normalized forms used by the Python search path for Cyrillic-safe matching."""
    normalized = normalize_text(value)
    compact = compact_text(value)
    tokens = tokenize_text(value)
    return {item for item in [normalized, compact, *tokens] if item}


def effective_product_price(product) -> Decimal:
    base = Decimal(product.price or 0)
    discount = getattr(product, "discount_price", None)
    if discount is None:
        return base
    discount_value = Decimal(discount or 0)
    if discount_value > 0 and discount_value < base:
        return discount_value
    return base


def minimum_order_shortage(
    subtotal: Decimal | int | float | None,
    minimum: Decimal | int | float = MIN_ORDER_AMOUNT,
) -> Decimal:
    subtotal_value = Decimal(str(subtotal or 0))
    minimum_value = Decimal(str(minimum or 0))
    shortage = minimum_value - subtotal_value
    if shortage <= 0:
        return Decimal("0")
    return shortage.quantize(Decimal("0.01"))


def format_rub_amount(value: Decimal | int | float | None) -> str:
    amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    whole_amount = amount.quantize(Decimal("1"))
    if amount == whole_amount:
        whole = f"{int(whole_amount):,}".replace(",", " ")
        return f"{whole} ₽"

    normalized = format(amount.normalize(), "f")
    whole_part, fraction_part = normalized.split(".")
    whole = f"{int(whole_part):,}".replace(",", " ")
    fraction = fraction_part.rstrip("0")
    return f"{whole},{fraction} ₽" if fraction else f"{whole} ₽"


def minimum_order_message(
    subtotal: Decimal | int | float | None,
    minimum: Decimal | int | float = MIN_ORDER_AMOUNT,
) -> str:
    shortage = minimum_order_shortage(subtotal, minimum)
    minimum_value = Decimal(str(minimum or 0))
    return (
        f"Минимальная сумма заказа — {format_rub_amount(minimum_value)}. "
        f"Добавьте товары еще на {format_rub_amount(shortage)}."
    )


def product_price_payload(product) -> dict[str, float | bool | None]:
    base = Decimal(product.price or 0)
    discount = getattr(product, "discount_price", None)
    discount_value = Decimal(discount or 0) if discount is not None else None
    has_discount = bool(discount_value and discount_value > 0 and discount_value < base)
    final_price = discount_value if has_discount else base
    return {
        "base_price": round(float(base), 2),
        "discount_price": round(float(discount_value), 2) if discount_value is not None else None,
        "final_price": round(float(final_price), 2),
        "has_discount": has_discount,
    }


def product_stock_quantity(product) -> int:
    try:
        return max(0, int(getattr(product, "stock", 0) or 0))
    except (TypeError, ValueError):
        return 0


def product_unit(product) -> str:
    unit = (getattr(product, "unit", None) or "").strip()
    return unit[:50] if unit else "\u0448\u0442"


def product_low_stock_threshold(product) -> int:
    try:
        return max(0, int(getattr(product, "low_stock_threshold", 0) or 0))
    except (TypeError, ValueError):
        return 0


def product_stock_status(product) -> str:
    quantity = product_stock_quantity(product)
    if quantity <= 0:
        return "out"
    if quantity <= product_low_stock_threshold(product):
        return "low"
    return "ok"


def product_stock_label(product) -> str:
    quantity = product_stock_quantity(product)
    unit = product_unit(product)
    if quantity <= 0:
        return "\u041d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438"
    if quantity <= product_low_stock_threshold(product):
        return f"\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c \u043c\u0430\u043b\u043e: {quantity} {unit}"
    return f"\u0412 \u043d\u0430\u043b\u0438\u0447\u0438\u0438: {quantity} {unit}"


def product_stock_payload(product) -> dict[str, int | str]:
    return {
        "stock_quantity": product_stock_quantity(product),
        "unit": product_unit(product),
        "low_stock_threshold": product_low_stock_threshold(product),
        "stock_status": product_stock_status(product),
        "stock_label": product_stock_label(product),
    }


def effective_product_price_expr(product_model):
    return case(
        (
            and_(
                product_model.discount_price.isnot(None),
                product_model.discount_price > 0,
                product_model.discount_price < product_model.price,
            ),
            product_model.discount_price,
        ),
        else_=product_model.price,
    )


def platform_commission_percent(db) -> Decimal:
    from models import PlatformSetting

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "platform_commission_percent").first()
    if not setting:
        setting = PlatformSetting(key="platform_commission_percent", value="7")
        db.add(setting)
        db.flush()
    try:
        value = Decimal(str(setting.value))
    except Exception:
        value = Decimal("7")
    if value < 0:
        return Decimal("0")
    if value > 100:
        return Decimal("100")
    return value


def build_product_search_filter(product_model, user_model, raw_query: str | None):
    terms = expand_search_terms(raw_query)
    if not terms:
        return None

    conditions = []
    for term in terms:
        pattern = f"%{term}%"
        conditions.append(
            or_(
                product_model.name.ilike(pattern),
                product_model.category.ilike(pattern),
                product_model.variety.ilike(pattern),
                product_model.region.ilike(pattern),
                product_model.description.ilike(pattern),
                user_model.full_name.ilike(pattern),
                user_model.farm_name.ilike(pattern),
                user_model.farm_address.ilike(pattern),
                user_model.farm_description.ilike(pattern),
            )
        )

    return or_(*conditions)
