from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from models import ChatMessage, Complaint, Notification, Order, OrderItem, Product, User


router = APIRouter(prefix="/chat", tags=["chat"])

COMPLAINT_CATEGORIES = {
    "payment": "оплата",
    "delivery": "доставка",
    "quality": "качество товара",
    "order": "заказ",
    "seller": "продавец",
    "buyer": "покупатель",
    "other": "другое",
}


def _load_order(order_id: int, db: Session) -> Order | None:
    return (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.user),
        )
        .filter(Order.id == order_id)
        .first()
    )


def _order_sellers(order: Order) -> list[User]:
    seen = set()
    sellers = []
    for item in order.items or []:
        seller = item.product.owner if item.product else None
        if seller and seller.id not in seen:
            seen.add(seller.id)
            sellers.append(seller)
    return sellers


def _can_access(order: Order, user: User) -> bool:
    if order.user_id == user.id:
        return True
    return any(seller.id == user.id for seller in _order_sellers(order))


def _default_recipient(order: Order, user: User) -> int | None:
    sellers = _order_sellers(order)
    if order.user_id == user.id:
        return sellers[0].id if sellers else None
    if user.role == "seller":
        return order.user_id
    return order.user_id


@router.get("/order/{order_id}")
def order_chat(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller"])
    if guard:
        return guard

    order = _load_order(order_id, db)
    if not order or not _can_access(order, user):
        return RedirectResponse("/order/orders", status_code=303)
    seller_id = _default_recipient(order, user) or 0
    if user.role == "user" and seller_id:
        return RedirectResponse(f"/conversations/order/{order.id}?seller_id={seller_id}", status_code=303)
    return RedirectResponse(f"/conversations/order/{order.id}", status_code=303)


@router.get("/product/{product_id}")
def product_chat_alias(product_id: int, request: Request):
    # Legacy route kept for old links/buttons; canonical flow lives in /conversations/product/{id}.
    return RedirectResponse(f"/conversations/product/{product_id}", status_code=303)


@router.post("/order/{order_id}/message")
def post_order_message(
    order_id: int,
    request: Request,
    message: str = Form(""),
    recipient_id: int = Form(0),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller"])
    if guard:
        return guard

    order = _load_order(order_id, db)
    if not order or not _can_access(order, user):
        return RedirectResponse("/order/orders", status_code=303)

    message = (message or "").strip()
    if len(message) < 2:
        request.session["chat_error"] = "РќР°РїРёС€РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ."
        return RedirectResponse(f"/chat/order/{order.id}", status_code=303)

    allowed_recipient_ids = {seller.id for seller in _order_sellers(order)}
    if order.user_id:
        allowed_recipient_ids.add(order.user_id)
    if recipient_id not in allowed_recipient_ids:
        recipient_id = _default_recipient(order, user) or 0

    db.add(ChatMessage(
        order_id=order.id,
        sender_id=user.id,
        recipient_id=recipient_id or None,
        message=message[:2000],
    ))
    if recipient_id:
        db.add(Notification(
            user_id=recipient_id,
            type="system",
            subject=f"РЎРѕРѕР±С‰РµРЅРёРµ РїРѕ Р·Р°РєР°Р·Сѓ {order.order_number or '#' + str(order.id)}",
            body=message[:500],
        ))
    db.commit()
    return RedirectResponse(f"/chat/order/{order.id}", status_code=303)


@router.post("/order/{order_id}/complaint")
def post_order_complaint(
    order_id: int,
    request: Request,
    category: str = Form("other"),
    text: str = Form(""),
    target_user_id: int = Form(0),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller"])
    if guard:
        return guard

    order = _load_order(order_id, db)
    if not order or not _can_access(order, user):
        return RedirectResponse("/order/orders", status_code=303)

    category = category if category in COMPLAINT_CATEGORIES else "other"
    text = (text or "").strip()
    if len(text) < 10:
        request.session["chat_error"] = "РћРїРёС€РёС‚Рµ СЃРёС‚СѓР°С†РёСЋ РјРёРЅРёРјСѓРј РІ 10 СЃРёРјРІРѕР»РѕРІ."
        return RedirectResponse(f"/chat/order/{order.id}", status_code=303)

    seller_ids = {seller.id for seller in _order_sellers(order)}
    if target_user_id not in seller_ids:
        target_user_id = next(iter(seller_ids), 0)

    db.add(Complaint(
        user_id=user.id,
        order_id=order.id,
        target_user_id=target_user_id or None,
        type=category,
        text=f"{COMPLAINT_CATEGORIES[category]}: {text}"[:2000],
        status="new",
    ))
    db.commit()
    request.session["chat_success"] = "Р–Р°Р»РѕР±Р° РѕС‚РїСЂР°РІР»РµРЅР° Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ."
    return RedirectResponse(f"/chat/order/{order.id}", status_code=303)

