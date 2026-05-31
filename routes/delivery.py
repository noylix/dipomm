# routes/delivery.py
# Трекинг доставки. Сама доставка создаётся в order.py при оформлении заказа.

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Order, Delivery, OrderItem
from auth import get_optional_user

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


