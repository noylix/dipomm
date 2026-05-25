# routes/payment.py
# Модуль оплаты и финансовых взаиморасчетов (Бровин Михаил)

import base64
import json
import os
import uuid
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware
from decimal import Decimal
from config import APP_BASE_URL

from database import get_db
from models import User, Wallet, Transaction, PaymentMethod, Order
from auth import get_optional_user, check_role
from marketplace_utils import product_stock_quantity
from order_statuses import normalize_order_status

router = APIRouter(prefix="/payment", tags=["payment"])
templates = Jinja2Templates(directory="templates")

MAX_PAYMENT_AMOUNT = Decimal("1000000")
ALLOWED_PAYMENT_METHODS = {"card_on_delivery", "cash", "wallet", "yookassa"}
YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments"
YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY", "")


def _resolve_return_url(request: Request) -> str:
    if APP_BASE_URL:
        return f"{APP_BASE_URL}/payment/yookassa/return"
    return str(request.url_for("yookassa_return"))


def _create_yookassa_payment(
    order: Order,
    user: User,
    amount: Decimal,
    return_url: str,
) -> tuple[str | None, str, str | None]:
    if not YOOKASSA_SHOP_ID:
        return None, "Не настроен YOOKASSA_SHOP_ID.", None

    payload = {
        "amount": {
            "value": f"{amount:.2f}",
            "currency": "RUB",
        },
        "capture": True,
        "confirmation": {
            "type": "redirect",
            "return_url": return_url,
        },
        "description": f"Оплата заказа #{order.id}",
        "metadata": {
            "order_id": str(order.id),
            "user_id": str(user.id),
        },
    }
    auth = base64.b64encode(f"{YOOKASSA_SHOP_ID}:{YOOKASSA_SECRET_KEY}".encode("utf-8")).decode("utf-8")
    req = urllib_request.Request(
        YOOKASSA_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/json",
            "Idempotence-Key": str(uuid.uuid4()),
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body)
    except Exception as exc:
        return None, f"Не удалось создать платеж ЮKassa: {exc}", None

    confirmation = parsed.get("confirmation") or {}
    url = confirmation.get("confirmation_url")
    if not url:
        return None, "ЮKassa не вернула ссылку на оплату.", None
    return url, "", parsed.get("id")


@router.get("/wallet", response_class=HTMLResponse)
def wallet_page(request: Request, db: Session = Depends(get_db)):
    """Страница кошелька пользователя"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    # Получаем или создаём кошелёк пользователя
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    # Получаем транзакции
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id
    ).order_by(Transaction.created_at.desc()).limit(50).all()

    # Получаем платёжные методы
    payment_methods = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user.id
    ).order_by(PaymentMethod.is_default.desc()).all()

    return templates.TemplateResponse("wallet", {
        "request": request,
        "user": user,
        "wallet": wallet,
        "transactions": transactions,
        "payment_methods": payment_methods
    })


@router.post("/wallet/deposit")
def deposit_wallet(
    request: Request,
    amount: Decimal = Form(...),
    payment_method: str = Form(...),
    db: Session = Depends(get_db)
):
    """Пополнение кошелька"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    if amount <= 0 or amount > MAX_PAYMENT_AMOUNT or payment_method not in ALLOWED_PAYMENT_METHODS:
        request.session["wallet_error"] = "Сумма должна быть положительной"
        return RedirectResponse(url="/payment/wallet", status_code=303)

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    # Создаём транзакцию пополнения
    transaction = Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        amount=amount,
        type="deposit",
        status="completed",
        payment_method=payment_method,
        description="Пополнение кошелька"
    )
    db.add(transaction)

    # Обновляем баланс
    wallet.balance += amount
    db.commit()

    request.session["wallet_success"] = f"Кошелёк пополнен на {amount} ₽"
    return RedirectResponse(url="/payment/wallet", status_code=303)


@router.post("/wallet/withdraw")
def withdraw_wallet(
    request: Request,
    amount: Decimal = Form(...),
    db: Session = Depends(get_db)
):
    """Вывод средств из кошелька"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    if amount <= 0 or amount > MAX_PAYMENT_AMOUNT:
        request.session["wallet_error"] = "Сумма должна быть положительной"
        return RedirectResponse(url="/payment/wallet", status_code=303)

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet or wallet.balance < amount:
        request.session["wallet_error"] = "Недостаточно средств на кошельке"
        return RedirectResponse(url="/payment/wallet", status_code=303)

    # Создаём транзакцию вывода
    transaction = Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        amount=amount,
        type="withdrawal",
        status="pending",
        description="Вывод средств"
    )
    db.add(transaction)

    # Резервируем средства
    wallet.balance -= amount
    db.commit()

    request.session["wallet_success"] = f"Запрос на вывод {amount} ₽ создан"
    return RedirectResponse(url="/payment/wallet", status_code=303)


@router.get("/transactions", response_class=HTMLResponse)
def transactions_page(request: Request, db: Session = Depends(get_db)):
    """История финансовых операций пользователя"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id
    ).order_by(Transaction.created_at.desc(), Transaction.id.desc()).all()

    return templates.TemplateResponse("transactions", {
        "request": request,
        "user": user,
        "transactions": transactions
    })


@router.get("/{order_id}")
def payment_page(order_id: int, request: Request, db: Session = Depends(get_db)):
    """Страница оплаты заказа"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.payment_status == "paid":
        return RedirectResponse(url="/order/orders", status_code=303)

    # Получаем кошелёк и платёжные методы
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    payment_methods = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user.id,
        PaymentMethod.is_active == 1
    ).all()

    return templates.TemplateResponse("payment", {
        "request": request,
        "user": user,
        "order": order,
        "wallet": wallet,
        "payment_methods": payment_methods,
        "yookassa_ready": bool(YOOKASSA_SHOP_ID),
    })


@router.get("/{order_id}/demo")
def yookassa_demo_page(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if order.payment_status == "paid":
        return RedirectResponse(url="/order/orders", status_code=303)

    return templates.TemplateResponse("payment_demo", {
        "request": request,
        "user": user,
        "order": order,
    })


@router.post("/{order_id}/demo/complete")
def yookassa_demo_complete(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id
    ).first()
    if not order:
        request.session["payment_error"] = "Заказ не найден"
        return RedirectResponse(url="/order/orders", status_code=303)
    if order.payment_status == "paid":
        return RedirectResponse(url="/order/orders", status_code=303)

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0)
        db.add(wallet)
        db.flush()

    amount_to_pay = Decimal(order.total_price or 0)
    db.add(Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        order_id=order.id,
        amount=amount_to_pay,
        type="payment",
        status="completed",
        payment_method="yookassa",
        description=f"Демо-оплата заказа #{order.id} через ЮKassa",
        external_id=f"demo_yookassa_{order.id}_{user.id}",
    ))
    order.payment_status = "paid"
    order.status = "paid"
    order.escrow_status = "pending"
    order.selected_payment_method = "yookassa"
    db.commit()

    request.session["payment_success"] = f"Заказ #{order.id} оплачен через демо ЮKassa"
    return RedirectResponse(url="/order/orders", status_code=303)


@router.post("/{order_id}/pay")
def process_payment(
    order_id: int,
    request: Request,
    payment_method: str = Form(...),
    use_wallet: int = Form(0),
    db: Session = Depends(get_db)
):
    """Обработка оплаты заказа"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id
    ).first()

    if not order or order.payment_status == "paid":
        return RedirectResponse(url="/order/orders", status_code=303)

    if payment_method not in ALLOWED_PAYMENT_METHODS:
        request.session["payment_error"] = "Недопустимый способ оплаты"
        return RedirectResponse(url=f"/payment/{order_id}", status_code=303)

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    amount_to_pay = Decimal(order.total_price)

    existing_pending = db.query(Transaction).filter(
        Transaction.order_id == order.id,
        Transaction.payment_method == "yookassa",
        Transaction.status == "pending",
    ).first()
    if payment_method == "yookassa" and existing_pending:
        request.session["payment_error"] = "Оплата по этому заказу уже ожидает подтверждения."
        return RedirectResponse(url="/order/orders", status_code=303)

    # Оплата с кошелька
    if use_wallet:
        if not wallet or wallet.balance < amount_to_pay:
            request.session["payment_error"] = "Недостаточно средств на кошельке"
            return RedirectResponse(url=f"/payment/{order_id}", status_code=303)

        # Создаём транзакцию оплаты
        transaction = Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="completed",
            payment_method="wallet",
            description=f"Оплата заказа #{order.id}"
        )
        db.add(transaction)

        # Списываем средства
        wallet.balance -= amount_to_pay
    elif payment_method != "yookassa":
        # Оплата внешней платёжной системой
        if not wallet:
            wallet = Wallet(user_id=user.id, balance=0)
            db.add(wallet)
            db.commit()
            db.refresh(wallet)

        transaction = Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="completed",
            payment_method=payment_method,
            description=f"Оплата заказа #{order.id}",
            external_id=f"ext_{order.id}_{user.id}"
        )
        db.add(transaction)

    if payment_method == "yookassa":
        if not YOOKASSA_SHOP_ID:
            return RedirectResponse(url=f"/payment/{order_id}/demo", status_code=303)
        confirmation_url, error, yookassa_payment_id = _create_yookassa_payment(
            order,
            user,
            amount_to_pay,
            _resolve_return_url(request),
        )
        if error:
            request.session["payment_error"] = error
            return RedirectResponse(url=f"/payment/{order_id}", status_code=303)

        if not wallet:
            wallet = Wallet(user_id=user.id, balance=0)
            db.add(wallet)
            db.flush()
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=user.id,
            order_id=order.id,
            amount=amount_to_pay,
            type="payment",
            status="pending",
            payment_method="yookassa",
            description=f"Ожидание оплаты заказа #{order.id} через ЮKassa",
            external_id=yookassa_payment_id,
        ))
        order.selected_payment_method = "yookassa"
        db.commit()
        return RedirectResponse(url=confirmation_url, status_code=303)

    # Обновляем статус заказа
    order.payment_status = "paid"
    order.status = "paid"
    order.escrow_status = "pending"
    db.commit()

    request.session["payment_success"] = f"Заказ #{order.id} оплачен"
    return RedirectResponse(url="/order/orders", status_code=303)


@router.get("/yookassa/return")
def yookassa_return(request: Request):
    request.session["payment_success"] = "Платеж ЮKassa отправлен на проверку."
    return RedirectResponse(url="/order/orders", status_code=303)


@router.post("/yookassa/webhook")
async def yookassa_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    event = (payload or {}).get("event")
    obj = (payload or {}).get("object") or {}
    payment_id = obj.get("id")
    metadata = obj.get("metadata") or {}
    order_id = metadata.get("order_id")
    if not payment_id or not order_id:
        return {"ok": False}

    order = db.query(Order).filter(Order.id == int(order_id)).first()
    if not order:
        return {"ok": False}

    tx = db.query(Transaction).filter(
        Transaction.order_id == order.id,
        Transaction.payment_method == "yookassa",
        Transaction.external_id == payment_id,
    ).order_by(Transaction.id.desc()).first()

    if event == "payment.succeeded":
        if order.payment_status != "paid":
            order.payment_status = "paid"
            order.status = "paid"
            order.escrow_status = "pending"
        if tx:
            tx.status = "completed"
        db.commit()
        return {"ok": True}

    if event in {"payment.canceled", "payment.waiting_for_capture"}:
        if tx and tx.status == "pending":
            tx.status = "failed"
            db.commit()
        return {"ok": True}

    return {"ok": True}


def _refund_order_to_wallet(order: Order, user: User, db: Session) -> Decimal | None:
    if order.payment_status != "paid" or order.escrow_status != "pending":
        return None
    if normalize_order_status(order.status) in ("canceled", "refunded", "completed"):
        return None

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0)
        db.add(wallet)
        db.flush()

    refund_amount = Decimal(order.total_price) - Decimal(order.platform_fee or 0)
    if refund_amount <= 0:
        return None

    transaction = Transaction(
        wallet_id=wallet.id,
        user_id=user.id,
        order_id=order.id,
        amount=refund_amount,
        type="refund",
        status="completed",
        payment_method="wallet",
        description=f"Возврат за заказ #{order.id}"
    )
    db.add(transaction)

    wallet.balance += refund_amount
    for item in order.items or []:
        if item.product and item.quantity:
            item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)
    order.escrow_status = "refunded"
    order.status = "refunded"
    order.return_status = "approved"
    db.commit()
    return refund_amount


def _refund_order_response(order_id: int, request: Request, db: Session):
    """Возврат средств за заказ на кошелёк пользователя"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id
    ).first()

    if not order:
        request.session["payment_error"] = "Заказ не найден"
        return RedirectResponse(url="/order/orders", status_code=303)

    refund_amount = _refund_order_to_wallet(order, user, db)
    if refund_amount is None:
        request.session["payment_error"] = "Возврат по этому заказу недоступен"
        return RedirectResponse(url="/order/orders", status_code=303)

    request.session["payment_success"] = f"Возврат {refund_amount} ₽ выполнен"
    return RedirectResponse(url="/payment/wallet", status_code=303)


@router.post("/{order_id}/refund")
def refund_order_post(order_id: int, request: Request, db: Session = Depends(get_db)):
    return _refund_order_response(order_id, request, db)


@router.post("/methods/add")
def add_payment_method(
    request: Request,
    type: str = Form(...),
    provider: str = Form(""),
    last_digits: str = Form(""),
    db: Session = Depends(get_db)
):
    """Добавление платёжного метода"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    # Если это первый метод, делаем его дефолтным
    if type not in {"card", "bank_transfer", "cash"}:
        request.session["payment_error"] = "Недопустимый тип платежного метода"
        return RedirectResponse(url="/payment/wallet", status_code=303)
    provider = provider.strip()[:100]
    last_digits = last_digits.strip()[:10]
    if last_digits and not last_digits.isdigit():
        request.session["payment_error"] = "Последние цифры карты должны быть числами"
        return RedirectResponse(url="/payment/wallet", status_code=303)

    existing_count = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user.id
    ).count()
    is_default = 1 if existing_count == 0 else 0

    payment_method = PaymentMethod(
        user_id=user.id,
        type=type,
        provider=provider,
        last_digits=last_digits,
        is_default=is_default
    )
    db.add(payment_method)
    db.commit()

    request.session["payment_success"] = "Платёжный метод добавлен"
    return RedirectResponse(url="/payment/wallet", status_code=303)


@router.post("/methods/{method_id}/set-default")
def set_default_payment_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Установка платёжного метода по умолчанию"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    # Сбрасываем все методы пользователя
    db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user.id
    ).update({"is_default": 0})

    # Устанавливаем выбранный метод
    payment_method = db.query(PaymentMethod).filter(
        PaymentMethod.id == method_id,
        PaymentMethod.user_id == user.id
    ).first()
    if payment_method:
        payment_method.is_default = 1
        db.commit()

    return RedirectResponse(url="/payment/wallet", status_code=303)


@router.post("/methods/{method_id}/delete")
def delete_payment_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Удаление платёжного метода"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    payment_method = db.query(PaymentMethod).filter(
        PaymentMethod.id == method_id,
        PaymentMethod.user_id == user.id
    ).first()
    if payment_method:
        db.delete(payment_method)
        db.commit()

    request.session["payment_success"] = "Платёжный метод удалён"
    return RedirectResponse(url="/payment/wallet", status_code=303)
