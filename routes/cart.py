# routes/cart.py
# Работа с корзиной покупок (только для авторизованных)

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from database import get_db
from delivery_service import seller_delivery_options, seller_slots
from coupon_utils import cart_seller_subtotals, evaluate_coupon, preview_coupon_message
from models import CartItem, Product, User
from auth import get_optional_user, check_role, is_email_verified
from routes.users import _verification_link_for_user
from marketplace_utils import (
    MIN_ORDER_AMOUNT,
    effective_product_price,
    minimum_order_message,
    minimum_order_shortage,
    product_stock_quantity,
    product_unit,
)

router = APIRouter(prefix="/cart", tags=["cart"])


def _wants_json(request: Request) -> bool:
    return (
        request.headers.get("x-requested-with") == "XMLHttpRequest"
        or "application/json" in request.headers.get("accept", "")
    )


def _cart_state_payload(user_id: int, db: Session) -> dict[str, object]:
    items = db.query(CartItem).filter(CartItem.user_id == user_id).all()
    quantities = {str(item.product_id): int(item.quantity or 0) for item in items if item.product_id}
    return {
        "position_count": len(quantities),
        "items": quantities,
    }


def _cart_json_response(user_id: int, db: Session, ok: bool = True, message: str = "") -> JSONResponse:
    payload = _cart_state_payload(user_id, db)
    payload.update({"ok": ok, "message": message})
    return JSONResponse(payload, status_code=200 if ok else 400)


def _cart_redirect(request: Request) -> RedirectResponse:
    return RedirectResponse(url=request.headers.get("referer") or "/cart/", status_code=303)


@router.get("/state")
def cart_state(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return {"position_count": 0, "items": {}}
    return _cart_state_payload(user.id, db)


@router.get("/")
def cart_list(request: Request, db: Session = Depends(get_db)):
    """Страница корзины с группировкой по фермерам (split-корзина)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product).joinedload(Product.owner))
        .filter(CartItem.user_id == user.id)
        .all()
    )
    cart_messages = []
    session_error = request.session.pop("cart_error", None)
    if session_error:
        cart_messages.append(session_error)

    valid_items = []
    changed = False
    for item in items:
        product = item.product
        if not product or product.status != "approved":
            db.delete(item)
            changed = True
            cart_messages.append("\u041e\u0434\u0438\u043d \u0438\u0437 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0438 \u0443\u0434\u0430\u043b\u0435\u043d \u0438\u0437 \u043a\u043e\u0440\u0437\u0438\u043d\u044b.")
            continue

        available = product_stock_quantity(product)
        if available <= 0:
            db.delete(item)
            changed = True
            cart_messages.append(f"{product.name}: \u043d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438. \u0422\u043e\u0432\u0430\u0440 \u0443\u0434\u0430\u043b\u0451\u043d \u0438\u0437 \u043a\u043e\u0440\u0437\u0438\u043d\u044b.")
            continue

        if item.quantity <= 0:
            item.quantity = 1
            changed = True
        if item.quantity > available:
            item.quantity = available
            changed = True
            cart_messages.append(
                f'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e "{product.name}" \u0443\u043c\u0435\u043d\u044c\u0448\u0435\u043d\u043e \u0434\u043e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0433\u043e \u043e\u0441\u0442\u0430\u0442\u043a\u0430: {available} {product_unit(product)}.'
            )
        valid_items.append(item)

    if changed:
        db.commit()

    items = valid_items

    # Группировка по фермеру (split-корзина)
    groups = {}
    for item in items:
        seller_id = item.product.owner_id if item.product else 0
        if seller_id not in groups:
            seller = item.product.owner if item.product and item.product.owner else None
            groups[seller_id] = {
                "seller_id": seller_id,
                "seller": seller,
                "seller_name": (
                    seller.farm_name or seller.full_name or "Фермер"
                ) if seller else "Фермер",
                "cart_items": [],
                "subtotal": 0,
                "min_order_amount": max(float(seller.min_order_amount or 0), float(MIN_ORDER_AMOUNT)) if seller else float(MIN_ORDER_AMOUNT),
                "delivery_options": seller_delivery_options(seller, MIN_ORDER_AMOUNT) if seller else [],
                "delivery_slots": seller_slots(seller) if seller else ["10-14", "14-18", "18-22"],
                "pickup_address": (seller.pickup_address or seller.farm_address or "") if seller else "",
                "shortage": 0,
                "is_min_order_met": True,
            }
        groups[seller_id]["cart_items"].append(item)

    # Подсчёт подытогов по фермерам
    total = 0
    for group in groups.values():
        subtotal = sum(effective_product_price(i.product) * i.quantity for i in group["cart_items"] if i.product)
        min_order_amount = max(float(group["min_order_amount"] or 0), float(MIN_ORDER_AMOUNT))
        group["subtotal"] = subtotal
        group["shortage"] = max(0, min_order_amount - float(subtotal))
        group["is_min_order_met"] = group["shortage"] <= 0
        total += subtotal

    min_order_shortage = minimum_order_shortage(total)
    has_min_order_errors = min_order_shortage > 0

    groups_payload = [group for group in groups.values() if group["cart_items"]]
    email_verified = is_email_verified(user)
    verification_link = ""
    if not email_verified:
        verification_link = (
            request.session.get("pending_verification")
            or request.session.get("verification_demo_link")
            or _verification_link_for_user(request, user, db)
        )

    return request.app.state.templates.TemplateResponse(
        request, "cart", {
            "seller_groups": groups_payload,
            "total": total,
            "has_min_order_errors": has_min_order_errors,
            "min_order_amount": float(MIN_ORDER_AMOUNT),
            "min_order_shortage": float(min_order_shortage),
            "min_order_message": minimum_order_message(total) if has_min_order_errors else "",
            "user": user,
            "email_verified": email_verified,
            "verification_link": verification_link,
            "cart_error": " ".join(cart_messages) if cart_messages else None,
            "cart_success": request.session.pop("cart_success", None),
            "checkout_form": request.session.get("checkout_form", {}),
        }
    )


@router.post("/add/{product_id}")
def cart_add(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Добавить товар в корзину"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or product.status != "approved":
        request.session["cart_error"] = "\u0422\u043e\u0432\u0430\u0440 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d."
        if _wants_json(request):
            return _cart_json_response(user.id, db, ok=False, message="Товар больше недоступен.")
        return _cart_redirect(request)

    available = product_stock_quantity(product)
    if available <= 0:
        request.session["cart_error"] = f"{product.name}: \u043d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438."
        if _wants_json(request):
            return _cart_json_response(user.id, db, ok=False, message=f"{product.name}: нет в наличии.")
        return _cart_redirect(request)

    existing = db.query(CartItem).filter(
        CartItem.user_id == user.id,
        CartItem.product_id == product_id
    ).first()

    if existing:
        if existing.quantity >= available:
            request.session["cart_error"] = (
                f'\u041d\u0435\u043b\u044c\u0437\u044f \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c "{product.name}" \u0431\u043e\u043b\u044c\u0448\u0435 {available} {product_unit(product)}.'
            )
            if _wants_json(request):
                return _cart_json_response(user.id, db, ok=False, message=f'Нельзя добавить "{product.name}" больше {available} {product_unit(product)}.')
            return _cart_redirect(request)
        existing.quantity += 1
    else:
        db.add(CartItem(user_id=user.id, product_id=product_id, quantity=1))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(CartItem).filter(
            CartItem.user_id == user.id,
            CartItem.product_id == product_id
        ).first()
        if existing and existing.quantity < available:
            existing.quantity += 1
            db.commit()
        else:
            request.session["cart_error"] = (
                f'\u041d\u0435\u043b\u044c\u0437\u044f \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c "{product.name}" \u0431\u043e\u043b\u044c\u0448\u0435 {available} {product_unit(product)}.'
            )
            if _wants_json(request):
                return _cart_json_response(user.id, db, ok=False, message=f'Нельзя добавить "{product.name}" больше {available} {product_unit(product)}.')
            return _cart_redirect(request)
    if _wants_json(request):
        return _cart_json_response(user.id, db, message="Добавлено в корзину.")
    return _cart_redirect(request)


@router.post("/dec-product/{product_id}")
def cart_dec_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    item = db.query(CartItem).filter(CartItem.user_id == user.id, CartItem.product_id == product_id).first()
    if item:
        if item.quantity > 1:
            item.quantity -= 1
        else:
            db.delete(item)
        db.commit()

    if _wants_json(request):
        return _cart_json_response(user.id, db)
    return _cart_redirect(request)


@router.post("/remove/{item_id}")
def cart_remove(item_id: int, request: Request, db: Session = Depends(get_db)):
    """Удалить товар из корзины полностью"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.user_id == user.id).first()
    if item:
        db.delete(item)
        db.commit()
    return RedirectResponse(url="/cart/", status_code=303)


@router.post("/inc/{item_id}")
def cart_inc(item_id: int, request: Request, db: Session = Depends(get_db)):
    """Увеличить количество товара в корзине на 1"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    item = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.id == item_id, CartItem.user_id == user.id)
        .first()
    )
    if item:
        if not item.product or item.product.status != "approved":
            db.delete(item)
            db.commit()
            request.session["cart_error"] = "\u0422\u043e\u0432\u0430\u0440 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0438 \u0443\u0434\u0430\u043b\u0451\u043d \u0438\u0437 \u043a\u043e\u0440\u0437\u0438\u043d\u044b."
            return RedirectResponse(url="/cart/", status_code=303)
        available = product_stock_quantity(item.product)
        if available <= 0:
            db.delete(item)
            db.commit()
            request.session["cart_error"] = f"{item.product.name}: \u043d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438."
            return RedirectResponse(url="/cart/", status_code=303)
        if item.quantity >= available:
            item.quantity = available
            db.commit()
            request.session["cart_error"] = (
                f'\u041d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435 \u0442\u043e\u043b\u044c\u043a\u043e {available} {product_unit(item.product)} \u0442\u043e\u0432\u0430\u0440\u0430 "{item.product.name}".'
            )
            return RedirectResponse(url="/cart/", status_code=303)
        item.quantity += 1
        db.commit()
    return RedirectResponse(url="/cart/", status_code=303)


@router.post("/dec/{item_id}")
def cart_dec(item_id: int, request: Request, db: Session = Depends(get_db)):
    """Уменьшить количество. Если стало 0 — удалить из корзины"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.user_id == user.id).first()
    if item:
        if item.quantity > 1:
            item.quantity -= 1
        else:
            db.delete(item)
        db.commit()
    return RedirectResponse(url="/cart/", status_code=303)


@router.post("/coupon/preview")
async def cart_coupon_preview(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return JSONResponse({"ok": False, "message": "Требуется авторизация."}, status_code=401)

    form = await request.form()
    code = str(form.get("coupon_code") or "")
    seller_subtotals = cart_seller_subtotals(db, user.id)
    if not seller_subtotals:
        return JSONResponse({"ok": False, "message": "Корзина пуста."})

    coupon, discount, error = evaluate_coupon(db, code, seller_subtotals)
    if error:
        return JSONResponse({"ok": False, "message": error})

    seller = None
    if coupon and coupon.seller_id:
        seller = db.query(User).filter(User.id == coupon.seller_id).first()

    return JSONResponse({
        "ok": True,
        "code": coupon.code if coupon else "",
        "discount_percent": int(coupon.discount_percent or 0) if coupon else 0,
        "discount_amount": float(discount),
        "seller_name": (seller.farm_name or seller.full_name or "Фермер") if seller else "",
        "valid_to": coupon.valid_to.isoformat() if coupon and coupon.valid_to else None,
        "scope": "seller" if coupon and coupon.seller_id else "platform",
        "message": preview_coupon_message(coupon, discount, seller) if coupon else "",
    })


@router.post("/clear")
def cart_clear(request: Request, db: Session = Depends(get_db)):
    """Очистить корзину полностью"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    db.query(CartItem).filter(CartItem.user_id == user.id).delete()
    db.commit()
    return RedirectResponse(url="/cart/", status_code=303)

