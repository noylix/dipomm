# routes/delivery.py
# Создание доставки для заказа

from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Order, Delivery, OrderItem
from auth import get_optional_user, check_role
from order_statuses import normalize_order_status

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.get("/track/{track_number}")
def delivery_track(track_number: str, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if not user or user.role not in {"user", "seller", "admin"}:
        return RedirectResponse("/", status_code=303)

    delivery = (
        db.query(Delivery)
        .options(joinedload(Delivery.order).joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Delivery.track_number == track_number)
        .first()
    )
    if not delivery or not delivery.order:
        return RedirectResponse("/", status_code=303)

    order = delivery.order
    owns_delivery = order.user_id == user.id
    if user.role == "seller":
        owns_delivery = any(item.product and item.product.owner_id == user.id for item in (order.items or []))
    if user.role == "admin":
        owns_delivery = True
    if not owns_delivery:
        return RedirectResponse("/", status_code=303)

    return request.app.state.templates.TemplateResponse(
        request,
        "delivery_track",
        {
            "user": user,
            "delivery": delivery,
            "order": order,
        },
    )


@router.post("/create")
def delivery_create(
    request: Request,
    order_id: int = Form(...),
    address: str = Form(...),
    method: str = Form(...),
    delivery_date: str = Form(""),
    db: Session = Depends(get_db)
):
    """Создать доставку для заказа с выбором даты"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        return RedirectResponse(url="/order/orders", status_code=303)

    # Если доставка уже создана — не создаём вторую
    existing = db.query(Delivery).filter(Delivery.order_id == order_id).first()
    if existing:
        return RedirectResponse(url="/order/orders", status_code=303)

    # Расчет стоимости доставки
    delivery_prices = {"courier": 500, "post": 300, "pickup": 0}
    if method not in delivery_prices:
        return RedirectResponse(url="/order/orders", status_code=303)
    price = delivery_prices[method]

    from datetime import datetime
    parsed_date = None
    if delivery_date:
        try:
            parsed_date = datetime.strptime(delivery_date, "%Y-%m-%d")
        except ValueError:
            pass

    delivery = Delivery(order_id=order_id, address=address, method=method, delivery_date=parsed_date)
    db.add(delivery)

    # Пересчитываем итог заказа: товары + доставка (без учёта скидки — т.к. скидка уже применена)
    order.total_price = float(order.total_price) + price
    if order.payment_status == "paid" and normalize_order_status(order.status) in ("paid", "assembling"):
        order.status = "delivering"

    db.commit()
    return RedirectResponse(url="/order/orders", status_code=303)
