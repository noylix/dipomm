# routes/cart.py
# Р Р°Р±РѕС‚Р° СЃ РєРѕСЂР·РёРЅРѕР№ РїРѕРєСѓРїРѕРє (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹С…)

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import CartItem, Product, Wallet
from auth import get_optional_user, check_role
from marketplace_utils import (
    MIN_ORDER_AMOUNT,
    effective_product_price,
    minimum_order_message,
    minimum_order_shortage,
    product_stock_quantity,
    product_unit,
)

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("/")
def cart_list(request: Request, db: Session = Depends(get_db)):
    """РЎС‚СЂР°РЅРёС†Р° РєРѕСЂР·РёРЅС‹ СЃ РіСЂСѓРїРїРёСЂРѕРІРєРѕР№ РїРѕ С„РµСЂРјРµСЂР°Рј (split-РєРѕСЂР·РёРЅР°)"""
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

    # Р“СЂСѓРїРїРёСЂРѕРІРєР° РїРѕ С„РµСЂРјРµСЂСѓ (split-РєРѕСЂР·РёРЅР°)
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
                "shortage": 0,
                "is_min_order_met": True,
            }
        groups[seller_id]["cart_items"].append(item)

    # РџРѕРґСЃС‡С‘С‚ РїРѕРґС‹С‚РѕРіРѕРІ РїРѕ С„РµСЂРјРµСЂР°Рј
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
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()

    return request.app.state.templates.TemplateResponse(
        request, "cart", {
            "seller_groups": groups_payload,
            "total": total,
            "wallet_balance": float(wallet.balance or 0) if wallet else 0,
            "has_wallet": bool(wallet),
            "has_min_order_errors": has_min_order_errors,
            "min_order_amount": float(MIN_ORDER_AMOUNT),
            "min_order_shortage": float(min_order_shortage),
            "min_order_message": minimum_order_message(total) if has_min_order_errors else "",
            "user": user,
            "cart_error": " ".join(cart_messages) if cart_messages else None,
            "cart_success": request.session.pop("cart_success", None),
            "checkout_form": request.session.get("checkout_form", {}),
        }
    )


@router.post("/add/{product_id}")
def cart_add(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Р”РѕР±Р°РІРёС‚СЊ С‚РѕРІР°СЂ РІ РєРѕСЂР·РёРЅСѓ"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or product.status != "approved":
        request.session["cart_error"] = "\u0422\u043e\u0432\u0430\u0440 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d."
        return RedirectResponse(url="/cart/", status_code=303)

    available = product_stock_quantity(product)
    if available <= 0:
        request.session["cart_error"] = f"{product.name}: \u043d\u0435\u0442 \u0432 \u043d\u0430\u043b\u0438\u0447\u0438\u0438."
        return RedirectResponse(url="/cart/", status_code=303)

    existing = db.query(CartItem).filter(
        CartItem.user_id == user.id,
        CartItem.product_id == product_id
    ).first()

    if existing:
        if existing.quantity >= available:
            request.session["cart_error"] = (
                f'\u041d\u0435\u043b\u044c\u0437\u044f \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c "{product.name}" \u0431\u043e\u043b\u044c\u0448\u0435 {available} {product_unit(product)}.'
            )
            return RedirectResponse(url="/cart/", status_code=303)
        existing.quantity += 1
    else:
        db.add(CartItem(user_id=user.id, product_id=product_id, quantity=1))

    db.commit()
    return RedirectResponse(url="/cart/", status_code=303)


@router.post("/remove/{item_id}")
def cart_remove(item_id: int, request: Request, db: Session = Depends(get_db)):
    """РЈРґР°Р»РёС‚СЊ С‚РѕРІР°СЂ РёР· РєРѕСЂР·РёРЅС‹ РїРѕР»РЅРѕСЃС‚СЊСЋ"""
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
    """РЈРІРµР»РёС‡РёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ С‚РѕРІР°СЂР° РІ РєРѕСЂР·РёРЅРµ РЅР° 1"""
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
    """РЈРјРµРЅСЊС€РёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ. Р•СЃР»Рё СЃС‚Р°Р»Рѕ 0 вЂ” СѓРґР°Р»РёС‚СЊ РёР· РєРѕСЂР·РёРЅС‹"""
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


@router.post("/clear")
def cart_clear(request: Request, db: Session = Depends(get_db)):
    """РћС‡РёСЃС‚РёС‚СЊ РєРѕСЂР·РёРЅСѓ РїРѕР»РЅРѕСЃС‚СЊСЋ"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    db.query(CartItem).filter(CartItem.user_id == user.id).delete()
    db.commit()
    return RedirectResponse(url="/cart/", status_code=303)


