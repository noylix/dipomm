# routes/favorites.py
# Работа с избранными товарами (только для авторизованных)

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Favorite, Product
from auth import get_optional_user, check_role

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/check")
def favorites_check(request: Request, db: Session = Depends(get_db)):
    """Проверить какие товары в избранном (для JavaScript)"""
    user = get_optional_user(request, db)
    if not user:
        return []

    favorites = db.query(Favorite).filter(Favorite.user_id == user.id).all()
    return [fav.product_id for fav in favorites]


@router.get("/")
def favorites_list(request: Request, db: Session = Depends(get_db)):
    """Страница избранных товаров"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    favorites = (
        db.query(Favorite)
        .options(joinedload(Favorite.product).joinedload(Product.owner))
        .filter(Favorite.user_id == user.id)
        .all()
    )
    products = [fav.product for fav in favorites if fav.product]

    return request.app.state.templates.TemplateResponse(
        request, "favorites", {
            "products": products,
            "user": user
        }
    )


@router.post("/add/{product_id}")
def favorites_add(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Добавить товар в избранное"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return RedirectResponse(url="/", status_code=303)

    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.product_id == product_id
    ).first()

    if not existing:
        db.add(Favorite(user_id=user.id, product_id=product_id))
        db.commit()

    return RedirectResponse(url=request.headers.get("referer", "/"), status_code=303)


@router.post("/remove/{product_id}")
def favorites_remove(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Удалить товар из избранного"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    favorite = db.query(Favorite).filter(
        Favorite.user_id == user.id,
        Favorite.product_id == product_id
    ).first()

    if favorite:
        db.delete(favorite)
        db.commit()

    return RedirectResponse(url=request.headers.get("referer", "/"), status_code=303)
