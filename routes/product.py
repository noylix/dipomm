# routes/product.py
# Карточка товара и похожие товары

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Product, Review
from auth import get_optional_user
from marketplace_utils import effective_product_price

router = APIRouter(prefix="/product", tags=["product"])


@router.get("/{product_id}")
def product_detail(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Страница товара с похожими"""
    from fastapi.responses import RedirectResponse
    product = (
        db.query(Product)
        .options(joinedload(Product.owner))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        return RedirectResponse("/", status_code=303)

    # Не одобренные товары видны только владельцу и админу/менеджеру
    user = get_optional_user(request, db)
    if product.status != "approved":
        is_owner = user and product.owner_id == user.id
        is_admin = user and user.role == "admin"
        if not (is_owner or is_admin):
            return RedirectResponse("/", status_code=303)

    candidates = (
        db.query(Product)
        .options(joinedload(Product.owner))
        .filter(Product.status == "approved")
        .all()
    )
    current_price = float(effective_product_price(product))
    similar_scored = []
    for candidate in candidates:
        if candidate.id == product.id:
            continue
        score = 0
        if candidate.category == product.category:
            score += 3
        if candidate.owner_id == product.owner_id:
            score += 2
        if candidate.region and product.region and candidate.region == product.region:
            score += 2
        candidate_words = {word for word in (candidate.name or "").lower().split() if len(word) >= 4}
        product_words = {word for word in (product.name or "").lower().split() if len(word) >= 4}
        if candidate_words & product_words:
            score += 2
        diff = abs(float(effective_product_price(candidate)) - current_price)
        if diff <= 50:
            score += 2
        elif diff <= 100:
            score += 1
        if candidate.variety and product.variety and candidate.variety == product.variety:
            score += 1
        if score > 0:
            similar_scored.append((score, candidate))

    similar = [candidate for _, candidate in sorted(similar_scored, key=lambda item: (-item[0], item[1].id))[:6]]

    all_products = candidates[:40]

    reviews = (
        db.query(Review)
        .filter(
            Review.product_id == product_id,
            Review.status == "approved"
        )
        .order_by(Review.created_at.desc())
        .limit(5)
        .all()
    )

    return request.app.state.templates.TemplateResponse(
        request, "product",
        {"product": product, "similar": similar, "all_products": all_products, "reviews": reviews, "user": user}
    )
