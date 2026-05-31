"""Номера заявок фермеров на подключение к платформе."""

from __future__ import annotations

from datetime import datetime

from models import User

APPLICATION_NUMBER_PREFIX = "ZF"


def make_seller_application_number(user_id: int) -> str:
    return f"{APPLICATION_NUMBER_PREFIX}-{datetime.utcnow():%Y%m%d}-{int(user_id):05d}"


def ensure_seller_application_number(user: User) -> str:
    number = (user.seller_application_number or "").strip()
    if number:
        return number
    if not user.id:
        return ""
    number = make_seller_application_number(user.id)
    user.seller_application_number = number
    return number


def seller_application_number_label(user: User | None) -> str:
    if not user:
        return "—"
    number = (user.seller_application_number or "").strip()
    if number:
        return number
    if user.id:
        return make_seller_application_number(user.id)
    return "—"
