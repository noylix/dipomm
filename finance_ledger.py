# finance_ledger.py — виртуальные счета, эскроу и неизменяемый журнал операций

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from marketplace_utils import platform_commission_percent
from models import LedgerEntry, Notification, Order, OrderItem, Product, User, Wallet, WithdrawalRequest, PaymentDispute

AUTO_RELEASE_HOURS = 24


def _money(value) -> Decimal:
    return Decimal(value or 0).quantize(Decimal("0.01"))


def get_seller_wallet(db: Session, user_id: int) -> Wallet:
    wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == user_id, Wallet.account_type == "seller")
        .first()
    )
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance=0, held_balance=0, account_type="seller")
    db.add(wallet)
    db.flush()
    return wallet


def get_platform_wallet(db: Session) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.account_type == "platform").first()
    if wallet:
        return wallet
    wallet = Wallet(user_id=None, balance=0, held_balance=0, account_type="platform")
    db.add(wallet)
    db.flush()
    return wallet


def append_ledger_entry(
    db: Session,
    *,
    wallet_id: int,
    entry_type: str,
    direction: str,
    amount: Decimal,
    balance_after: Decimal,
    order_id: int | None = None,
    counterparty_wallet_id: int | None = None,
    description: str = "",
    reference_key: str,
    related_transaction_id: int | None = None,
) -> LedgerEntry | None:
    """Только вставка — журнал неизменяемый."""
    exists = db.query(LedgerEntry).filter(LedgerEntry.reference_key == reference_key).first()
    if exists:
        return exists
    entry = LedgerEntry(
        wallet_id=wallet_id,
        order_id=order_id,
        counterparty_wallet_id=counterparty_wallet_id,
        entry_type=entry_type,
        direction=direction,
        amount=_money(amount),
        balance_after=_money(balance_after),
        description=description[:500],
        reference_key=reference_key,
        related_transaction_id=related_transaction_id,
    )
    db.add(entry)
    return entry


def seller_money_breakdown(order: Order, seller_id: int) -> tuple[Decimal, Decimal, Decimal]:
    """(сумма товаров продавца, комиссия, к выплате)."""
    order_goods_total = Decimal("0")
    seller_goods_total = Decimal("0")
    for item in order.items or []:
        if not item.product:
            continue
        from marketplace_utils import effective_product_price

        item_total = Decimal(effective_product_price(item.product)) * Decimal(int(item.quantity or 0))
        order_goods_total += item_total
        if item.product.owner_id == seller_id:
            seller_goods_total += item_total
    if seller_goods_total <= 0:
        return Decimal("0"), Decimal("0"), Decimal("0")
    platform_fee = Decimal(order.platform_fee or 0)
    seller_fee = Decimal("0")
    if order_goods_total > 0 and platform_fee > 0:
        seller_fee = (platform_fee * seller_goods_total / order_goods_total).quantize(Decimal("0.01"))
    seller_net = (seller_goods_total - seller_fee).quantize(Decimal("0.01"))
    return seller_goods_total.quantize(Decimal("0.01")), seller_fee, seller_net


def order_settlement_payload(order: Order, seller_id: int, db: Session) -> dict:
    goods, commission, net = seller_money_breakdown(order, seller_id)
    percent = platform_commission_percent(db)
    return {
        "goods_total": float(goods),
        "commission_percent": float(percent),
        "commission_amount": float(commission),
        "seller_net": float(net),
        "escrow_status": order.escrow_status or "pending",
        "payout_status": order.payout_status or "pending",
    }


def _seller_ids_for_order(order: Order) -> list[int]:
    ids: list[int] = []
    seen: set[int] = set()
    for item in order.items or []:
        if item.product and item.product.owner_id and item.product.owner_id not in seen:
            seen.add(item.product.owner_id)
            ids.append(item.product.owner_id)
    return ids


def record_escrow_hold_on_payment(db: Session, order: Order) -> None:
    """Деньги на счёте платформы в удержании до подтверждения получения."""
    if order.payment_status != "paid":
        return
    ref = f"escrow_hold:{order.id}"
    if db.query(LedgerEntry).filter(LedgerEntry.reference_key == ref).first():
        return

    amount = _money(order.payment_amount or order.total_price)
    if amount <= 0:
        return

    platform = get_platform_wallet(db)
    platform.balance = _money(platform.balance) + amount
    platform.held_balance = _money(platform.held_balance) + amount

    append_ledger_entry(
        db,
        wallet_id=platform.id,
        entry_type="escrow_hold",
        direction="credit",
        amount=amount,
        balance_after=_money(platform.balance),
        order_id=order.id,
        description=f"Оплата заказа #{order.order_number or order.id} (удержание)",
        reference_key=ref,
    )


def release_escrow_for_order(db: Session, order: Order, *, trigger: str = "manual") -> bool:
    """Перевод средств с удержания платформы на баланс фермера."""
    if order.payment_status != "paid":
        return False
    if (order.escrow_status or "pending") != "pending":
        return False

    platform = get_platform_wallet(db)
    released_any = False

    for seller_id in _seller_ids_for_order(order):
        _, _, net = seller_money_breakdown(order, seller_id)
        if net <= 0:
            continue
        ref = f"escrow_release:{order.id}:{seller_id}"
        if db.query(LedgerEntry).filter(LedgerEntry.reference_key == ref).first():
            released_any = True
            continue

        seller_wallet = get_seller_wallet(db, seller_id)
        held = _money(platform.held_balance)
        if held < net:
            net = held
        if net <= 0:
            continue

        platform.held_balance = held - net
        seller_wallet.balance = _money(seller_wallet.balance) + net

        append_ledger_entry(
            db,
            wallet_id=platform.id,
            entry_type="escrow_release",
            direction="debit",
            amount=net,
            balance_after=_money(platform.balance),
            order_id=order.id,
            counterparty_wallet_id=seller_wallet.id,
            description=f"Выпуск средств фермеру по заказу #{order.order_number or order.id} ({trigger})",
            reference_key=ref,
        )
        append_ledger_entry(
            db,
            wallet_id=seller_wallet.id,
            entry_type="payout",
            direction="credit",
            amount=net,
            balance_after=_money(seller_wallet.balance),
            order_id=order.id,
            counterparty_wallet_id=platform.id,
            description=f"Начисление по заказу #{order.order_number or order.id}",
            reference_key=f"{ref}:seller",
        )

        seller = db.query(User).filter(User.id == seller_id).first()
        if seller:
            db.add(
                Notification(
                    user_id=seller_id,
                    type="system",
                    subject="Средства зачислены",
                    body=f"По заказу #{order.order_number or order.id} на ваш баланс зачислено {float(net):.2f} ₽.",
                )
            )
        released_any = True

    if released_any:
        order.escrow_status = "released"
        order.escrow_released_at = datetime.utcnow()
        if order.status not in ("completed", "received"):
            order.status = "received"
    return released_any


def mark_order_delivered(db: Session, order: Order) -> None:
    if not order.delivered_at:
        order.delivered_at = datetime.utcnow()
    order.auto_release_at = order.delivered_at + timedelta(hours=AUTO_RELEASE_HOURS)


def process_auto_escrow_releases(db: Session) -> int:
    """Автовыпуск через 24 ч после доставки, если покупатель не подтвердил."""
    now = datetime.utcnow()
    orders = (
        db.query(Order)
        .filter(
            Order.payment_status == "paid",
            Order.escrow_status == "pending",
            Order.delivered_at.isnot(None),
            Order.auto_release_at.isnot(None),
            Order.auto_release_at <= now,
        )
        .limit(50)
        .all()
    )
    count = 0
    for order in orders:
        if release_escrow_for_order(db, order, trigger="auto_24h"):
            count += 1
    if count:
        db.commit()
    return count


def wallet_summary(db: Session, user_id: int) -> dict:
    wallet = get_seller_wallet(db, user_id)
    pending = (
        db.query(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .filter(
            Product.owner_id == user_id,
            Order.payment_status == "paid",
            Order.escrow_status == "pending",
        )
        .distinct()
        .count()
    )
    return {
        "balance": float(_money(wallet.balance)),
        "held_balance": float(_money(wallet.held_balance)),
        "available_balance": float(_money(wallet.balance)),
        "pending_escrow_orders": pending,
    }


def create_withdrawal_request(db: Session, seller: User, amount: Decimal) -> tuple[bool, str, WithdrawalRequest | None]:
    amount = _money(amount)
    if amount <= 0:
        return False, "Сумма должна быть больше нуля.", None
    wallet = get_seller_wallet(db, seller.id)
    if _money(wallet.balance) < amount:
        return False, "Недостаточно средств на балансе.", None

    wallet.balance = _money(wallet.balance) - amount
    req = WithdrawalRequest(seller_id=seller.id, amount=amount, status="pending")
    db.add(req)
    db.flush()

    append_ledger_entry(
        db,
        wallet_id=wallet.id,
        entry_type="withdrawal_request",
        direction="debit",
        amount=amount,
        balance_after=_money(wallet.balance),
        description=f"Заявка на вывод #{req.id}",
        reference_key=f"withdrawal_request:{req.id}",
    )
    return True, "", req


def admin_resolve_withdrawal(
    db: Session,
    request_id: int,
    admin: User,
    *,
    approve: bool,
    comment: str = "",
) -> tuple[bool, str]:
    req = db.query(WithdrawalRequest).filter(WithdrawalRequest.id == request_id).first()
    if not req or req.status != "pending":
        return False, "Заявка не найдена или уже обработана."

    wallet = get_seller_wallet(db, req.seller_id)
    amount = _money(req.amount)

    if approve:
        req.status = "paid"
        req.admin_id = admin.id
        req.admin_comment = (comment or "Выплата подтверждена администратором.")[:500]
        req.processed_at = datetime.utcnow()
        append_ledger_entry(
            db,
            wallet_id=wallet.id,
            entry_type="withdrawal_paid",
            direction="debit",
            amount=amount,
            balance_after=_money(wallet.balance),
            description=f"Вывод #{req.id} отмечен как выплаченный",
            reference_key=f"withdrawal_paid:{req.id}",
        )
        db.add(
            Notification(
                user_id=req.seller_id,
                type="system",
                subject="Вывод средств выполнен",
                body=f"Заявка на вывод {float(amount):.2f} ₽ отмечена как выплаченная. Перевод на расчётный счёт выполняется бухгалтерией.",
            )
        )
        return True, "Заявка подтверждена."

    req.status = "rejected"
    req.admin_id = admin.id
    req.admin_comment = (comment or "Заявка отклонена.")[:500]
    req.processed_at = datetime.utcnow()
    wallet.balance = _money(wallet.balance) + amount
    append_ledger_entry(
        db,
        wallet_id=wallet.id,
        entry_type="withdrawal_rejected",
        direction="credit",
        amount=amount,
        balance_after=_money(wallet.balance),
        description=f"Отклонение заявки на вывод #{req.id}",
        reference_key=f"withdrawal_rejected:{req.id}",
    )
    db.add(
        Notification(
            user_id=req.seller_id,
            type="system",
            subject="Заявка на вывод отклонена",
            body=f"Заявка на {float(amount):.2f} ₽ отклонена. {req.admin_comment}",
        )
    )
    return True, "Заявка отклонена, средства возвращены на баланс."


def create_payment_dispute(
    db: Session,
    *,
    order_id: int,
    admin_id: int,
    resolution: str,
    note: str,
) -> tuple[bool, str]:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False, "Заказ не найден."
    dispute = PaymentDispute(
        order_id=order.id,
        buyer_id=order.user_id,
        amount=_money(order.payment_amount or order.total_price),
        status="open",
        resolution_note=note[:2000],
        admin_id=admin_id,
    )
    for seller_id in _seller_ids_for_order(order):
        dispute.seller_id = seller_id
        break
    db.add(dispute)

    if resolution == "refund_buyer" and order.payment_status == "paid":
        from payment_refunds import refund_order_payment

        ok, msg, _ = refund_order_payment(db, order, note or f"Спор по заказу #{order.id}")
        if not ok:
            return False, msg
        dispute.status = "resolved_buyer"
        order.escrow_status = "refunded"
    elif resolution == "keep_seller":
        if (order.escrow_status or "") == "pending":
            release_escrow_for_order(db, order, trigger="dispute_seller")
        dispute.status = "resolved_seller"
    else:
        dispute.status = "closed"

    dispute.resolved_at = datetime.utcnow()
    return True, "Спор обработан."
