# Legacy chat redirect — historical /chat/order/* and /chat/product/* links now
# resolve to canonical conversation pages. Real chat lives in routes/conversations.py.

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from auth import check_role, get_optional_user
from database import get_db
from models import Order, OrderItem, Product, User


router = APIRouter(prefix="/chat", tags=["chat"])


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
    seen: set[int] = set()
    sellers: list[User] = []
    for item in order.items or []:
        seller = item.product.owner if item.product else None
        if seller and seller.id not in seen:
            seen.add(seller.id)
            sellers.append(seller)
    return sellers


@router.get("/order/{order_id}")
def order_chat(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user", "seller"])
    if guard:
        return guard

    order = _load_order(order_id, db)
    if not order:
        return RedirectResponse("/order/orders", status_code=303)

    sellers = _order_sellers(order)
    has_access = order.user_id == user.id or any(seller.id == user.id for seller in sellers)
    if not has_access:
        return RedirectResponse("/order/orders", status_code=303)

    if user.role == "user" and sellers:
        return RedirectResponse(
            f"/conversations/order/{order.id}?seller_id={sellers[0].id}",
            status_code=303,
        )
    return RedirectResponse(f"/conversations/order/{order.id}", status_code=303)


@router.get("/product/{product_id}")
def product_chat_alias(product_id: int, request: Request):
    return RedirectResponse(f"/conversations/product/{product_id}", status_code=303)
