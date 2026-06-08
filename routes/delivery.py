# routes/delivery.py
# Трекинг доставки. Сама доставка создаётся в order.py при оформлении заказа.

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session, joinedload
from cdek_delivery import (
    CDEK_PROVIDER_NAME,
    calculate_cdek_delivery_quote,
    fetch_cdek_delivery_points,
    fetch_cdek_order,
    cdek_order_status,
    is_cdek_provider,
    search_cdek_cities,
)
from database import get_db
from models import CartItem, Order, Delivery, OrderItem, Product
from auth import get_optional_user

router = APIRouter(prefix="/delivery", tags=["delivery"])


def _buyer_cart_items_for_seller(user_id: int, seller_id: int, db: Session) -> list[CartItem]:
    return (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .join(Product, Product.id == CartItem.product_id)
        .filter(CartItem.user_id == user_id, Product.owner_id == seller_id, Product.status == "approved")
        .all()
    )


@router.get("/cdek/cities")
def cdek_cities(request: Request, city: str = "", db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if not user or user.role != "user":
        return JSONResponse({"ok": False, "message": "Требуется вход покупателя."}, status_code=403)
    try:
        return {"ok": True, "cities": search_cdek_cities(city)}
    except Exception as exc:
        return JSONResponse({"ok": False, "message": f"СДЭК не вернул города: {exc}"}, status_code=502)


@router.get("/cdek/points")
def cdek_points(city_code: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if not user or user.role != "user":
        return JSONResponse({"ok": False, "message": "Требуется вход покупателя."}, status_code=403)
    try:
        return {"ok": True, "points": fetch_cdek_delivery_points(city_code)}
    except Exception as exc:
        return JSONResponse({"ok": False, "message": f"СДЭК не вернул ПВЗ: {exc}"}, status_code=502)


@router.post("/cdek/quote")
def cdek_quote(
    request: Request,
    seller_id: int = Form(...),
    city_code: int = Form(...),
    delivery_type: str = Form("pickup"),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    if not user or user.role != "user":
        return JSONResponse({"ok": False, "message": "Требуется вход покупателя."}, status_code=403)
    items = _buyer_cart_items_for_seller(user.id, seller_id, db)
    if not items:
        return JSONResponse({"ok": False, "message": "В корзине нет товаров этого фермера."}, status_code=400)
    try:
        quote = calculate_cdek_delivery_quote(items, city_code, delivery_type)
        return {
            "ok": True,
            "delivery_sum": float(quote.delivery_sum),
            "tariff_code": quote.tariff_code,
            "period_min": quote.period_min,
            "period_max": quote.period_max,
        }
    except Exception as exc:
        return JSONResponse({"ok": False, "message": f"СДЭК не рассчитал тариф: {exc}"}, status_code=502)


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

    if is_cdek_provider(delivery.provider) and delivery.external_id:
        try:
            cdek_order = fetch_cdek_order(delivery.external_id)
            entity = cdek_order.get("entity") or cdek_order
            delivery.track_number = str(entity.get("cdek_number") or delivery.track_number or "")
            delivery.external_id = str(entity.get("uuid") or delivery.external_id)
            delivery.status = cdek_order_status(entity) or delivery.status or ""
            if delivery.track_number:
                delivery.tracking_url = f"/delivery/track/{delivery.track_number}"
            db.commit()
        except Exception:
            db.rollback()

    return request.app.state.templates.TemplateResponse(
        request,
        "delivery_track",
        {
            "user": user,
            "delivery": delivery,
            "order": order,
        },
    )
