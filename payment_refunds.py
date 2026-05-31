"""Возврат оплаты на карту через ЮKassa."""

from __future__ import annotations

import base64
import json
import os
import uuid
from decimal import Decimal
from urllib import request as urllib_request

from sqlalchemy.orm import Session

from models import Order, Transaction, User, Wallet

YOOKASSA_REFUNDS_API_URL = "https://api.yookassa.ru/v3/refunds"
YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY", "")

REFUND_DEFERRED_MSG = "Возврат на карту будет выполнен после подключения ЮKassa."


def is_yookassa_configured() -> bool:
    return bool(YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY)


def is_demo_payment_id(payment_id: str | None) -> bool:
    return bool(payment_id) and str(payment_id).startswith("demo_")


def _is_yookassa_payment_id(payment_id: str | None) -> bool:
    payment_id = (payment_id or "").strip()
    if not payment_id:
        return False
    if is_demo_payment_id(payment_id):
        return False
    if payment_id.startswith("ext_"):
        return False
    return True


def refund_channel_label(_order: Order | None = None) -> str:
    return "на карту"


def _yookassa_auth_header() -> str:
    token = base64.b64encode(f"{YOOKASSA_SHOP_ID}:{YOOKASSA_SECRET_KEY}".encode()).decode()
    return f"Basic {token}"


def resolve_yookassa_payment_id(db: Session, order: Order) -> str | None:
    payment_id = (order.payment_id or "").strip()
    if _is_yookassa_payment_id(payment_id):
        return payment_id

    txs = (
        db.query(Transaction)
        .filter(
            Transaction.order_id == order.id,
            Transaction.type == "payment",
            Transaction.status == "completed",
        )
        .order_by(Transaction.id.desc())
        .all()
    )
    for tx in txs:
        if tx.external_id and _is_yookassa_payment_id(tx.external_id):
            return str(tx.external_id).strip()
    return None


def can_refund_to_card_now(db: Session, order: Order) -> bool:
    return is_yookassa_configured() and resolve_yookassa_payment_id(db, order) is not None


def create_yookassa_refund(payment_id: str, amount: Decimal, description: str) -> tuple[str | None, str]:
    if not is_yookassa_configured():
        return None, "ЮKassa не настроена: укажите YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY."
    if amount <= 0:
        return None, "Сумма возврата должна быть больше нуля."

    payload = {
        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
        "payment_id": payment_id,
        "description": (description or "Возврат")[:250],
    }
    req = urllib_request.Request(
        YOOKASSA_REFUNDS_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": _yookassa_auth_header(),
            "Content-Type": "application/json",
            "Idempotence-Key": str(uuid.uuid4()),
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            parsed = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return None, f"Не удалось оформить возврат на карту: {exc}"

    refund_id = parsed.get("id")
    status = (parsed.get("status") or "").lower()
    if status == "canceled":
        return None, "ЮKassa отклонила возврат на карту."
    if not refund_id:
        return None, "ЮKassa не вернула идентификатор возврата."
    return str(refund_id), ""


def _ledger_wallet(db: Session, user_id: int) -> Wallet:
    """Кошелёк только для учёта транзакций в БД, баланс при возврате не меняется."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance=0)
    db.add(wallet)
    db.flush()
    return wallet


def refund_order_payment(db: Session, order: Order, reason: str) -> tuple[bool, str, bool]:
    """
    (success, message, refunded)
    success=False — операцию прервать;
    success=True, refunded=False — продолжить без возврата денег (ЮKassa не подключена и т.п.);
    success=True, refunded=True — возврат на карту выполнен.
    """
    amount = Decimal(order.payment_amount or order.total_price or 0)
    return refund_order_payment_amount(db, order, amount, reason)


def refund_order_payment_amount(
    db: Session,
    order: Order,
    amount: Decimal,
    reason: str,
) -> tuple[bool, str, bool]:
    if amount <= 0:
        return True, "", False
    if order.payment_status == "refunded":
        return True, "", True
    if order.payment_status != "paid":
        return True, "", False

    buyer = db.query(User).filter(User.id == order.user_id).first()
    if not buyer:
        return False, "Покупатель не найден.", False

    if not can_refund_to_card_now(db, order):
        return True, REFUND_DEFERRED_MSG, False

    paid_total = Decimal(order.payment_amount or order.total_price or 0)
    amount = min(amount, paid_total).quantize(Decimal("0.01"))
    description = (reason or f"Возврат по заказу #{order.id}")[:500]
    payment_id = resolve_yookassa_payment_id(db, order)
    assert payment_id

    refund_id, error = create_yookassa_refund(payment_id, amount, description)
    if error:
        return False, error, False

    wallet = _ledger_wallet(db, buyer.id)
    db.add(
        Transaction(
            user_id=buyer.id,
            wallet_id=wallet.id,
            order_id=order.id,
            amount=amount,
            type="refund",
            status="completed",
            payment_method="yookassa",
            external_id=refund_id,
            description=description,
        )
    )

    remaining = (paid_total - amount).quantize(Decimal("0.01"))
    if remaining <= 0:
        order.payment_status = "refunded"
        order.escrow_status = "refunded"
        order.return_status = "approved"
        order.payment_amount = Decimal("0")
    else:
        order.payment_amount = remaining
    return True, "", True
