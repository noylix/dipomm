# routes/reviews.py
# Отзывы и рейтинги (модуль маркетплейса и интеллектуального поиска — Летунов Михаил)

from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from database import get_db
from models import Review, SellerReview, Order, OrderItem, Product, User
from auth import get_optional_user, check_role

router = APIRouter(prefix="/reviews", tags=["reviews"])
templates = Jinja2Templates(directory="templates")


@router.post("/create")
def review_create(
    request: Request,
    product_id: int = Form(...),
    order_id: int = Form(...),
    rating: int = Form(5),
    text: str = Form(""),
    db: Session = Depends(get_db)
):
    """Создать отзыв на товар из выполненного заказа"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    # Проверяем, что заказ существует, принадлежит пользователю и выполнен
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id,
        Order.status == "completed"
    ).first()
    if not order:
        return RedirectResponse("/order/orders", status_code=303)

    # Проверяем, что в заказе был этот товар
    has_product = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.product_id == product_id
    ).first()
    if not has_product:
        return RedirectResponse("/order/orders", status_code=303)

    # Проверяем, что отзыва ещё нет
    existing = db.query(Review).filter(
        Review.user_id == user.id,
        Review.product_id == product_id,
        Review.order_id == order_id
    ).first()
    if existing:
        return RedirectResponse("/order/orders", status_code=303)

    review = Review(
        user_id=user.id,
        product_id=product_id,
        order_id=order_id,
        rating=max(1, min(5, rating)),
        text=text,
        status="pending"
    )
    db.add(review)
    db.commit()
    return RedirectResponse("/order/orders", status_code=303)


@router.post("/seller/create")
def seller_review_create(
    request: Request,
    seller_id: int = Form(...),
    order_id: int = Form(...),
    rating: int = Form(5),
    text: str = Form(""),
    db: Session = Depends(get_db)
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user.id,
        Order.status == "completed"
    ).first()
    if not order:
        return RedirectResponse("/order/orders", status_code=303)

    seller = db.query(User).filter(
        User.id == seller_id,
        User.role == "seller",
        User.is_approved == 1
    ).first()
    if not seller:
        return RedirectResponse("/order/orders", status_code=303)

    has_seller_items = (
        db.query(OrderItem)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(
            OrderItem.order_id == order_id,
            Product.owner_id == seller_id
        )
        .first()
    )
    if not has_seller_items:
        return RedirectResponse("/order/orders", status_code=303)

    existing = db.query(SellerReview).filter(
        SellerReview.user_id == user.id,
        SellerReview.seller_id == seller_id,
        SellerReview.order_id == order_id
    ).first()
    if existing:
        return RedirectResponse("/order/orders", status_code=303)

    text = (text or "").strip()
    if len(text) < 5:
        request.session["payment_error"] = "Напишите короткий отзыв о продавце."
        return RedirectResponse("/order/orders", status_code=303)

    review = SellerReview(
        user_id=user.id,
        seller_id=seller_id,
        order_id=order_id,
        rating=max(1, min(5, rating)),
        text=text[:2000],
        status="approved",
    )
    db.add(review)
    db.commit()
    request.session["order_success"] = "Отзыв о продавце сохранен."
    return RedirectResponse("/order/orders", status_code=303)


@router.get("/product/{product_id}", response_class=HTMLResponse)
def product_reviews(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Страница отзывов на товар"""
    user = get_optional_user(request, db)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return RedirectResponse("/", status_code=303)

    # Получаем одобренные отзывы
    reviews = db.query(Review, User.email, User.role).join(
        User, Review.user_id == User.id
    ).filter(
        Review.product_id == product_id,
        Review.status == "approved"
    ).order_by(Review.created_at.desc()).limit(50).all()

    # Вычисляем средний рейтинг
    from sqlalchemy import func
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.product_id == product_id,
        Review.status == "approved"
    ).scalar()
    avg_rating = round(avg_rating, 1) if avg_rating else None

    review_list = []
    for review, email, role in reviews:
        review_list.append({
            "review": review,
            "user_email": email,
            "is_seller": role == "seller"
        })

    return templates.TemplateResponse("product_reviews", {
        "request": request,
        "user": user,
        "product": product,
        "reviews": review_list,
        "avg_rating": avg_rating
    })


@router.get("/admin", response_class=HTMLResponse)
def reviews_admin(request: Request, db: Session = Depends(get_db)):
    """Модерация отзывов — только manager и admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    pending_reviews = (
        db.query(Review)
        .options(
            joinedload(Review.user),
            joinedload(Review.order),
            joinedload(Review.product).joinedload(Product.owner),
        )
        .filter(Review.status == "pending")
        .order_by(Review.created_at.desc(), Review.id.desc())
        .all()
    )

    review_list = []
    for review in pending_reviews:
        product = review.product
        owner = product.owner if product else None
        order = review.order
        review_list.append({
            "review": review,
            "product_name": product.name if product else "—",
            "product_id": product.id if product else None,
            "user_email": review.user.email if review.user else "—",
            "user_name": (review.user.full_name if review.user else None) or "",
            "order": order,
            "order_id": review.order_id,
            "seller": owner,
        })

    return templates.TemplateResponse("reviews_admin", {
        "request": request,
        "user": user,
        "reviews": review_list
    })


@router.post("/admin/{review_id}/approve")
def approve_review(review_id: int, request: Request, db: Session = Depends(get_db)):
    """Одобрить отзыв"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    review = db.query(Review).filter(Review.id == review_id).first()
    if review:
        review.status = "approved"
        db.commit()

    return RedirectResponse("/reviews/admin", status_code=303)


@router.post("/admin/{review_id}/reject")
def reject_review(review_id: int, request: Request, db: Session = Depends(get_db)):
    """Отклонить отзыв"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    review = db.query(Review).filter(Review.id == review_id).first()
    if review:
        review.status = "rejected"
        db.commit()

    return RedirectResponse("/reviews/admin", status_code=303)


@router.post("/{review_id}/seller-response")
def seller_response(
    review_id: int,
    request: Request,
    response_text: str = Form(""),
    db: Session = Depends(get_db)
):
    """Ответ продавца на одобренный отзыв о его товаре"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["seller"])
    if guard:
        return guard

    review = db.query(Review).join(
        Product, Review.product_id == Product.id
    ).filter(
        Review.id == review_id,
        Review.status == "approved",
        Product.owner_id == user.id
    ).first()

    if review:
        response_text = response_text.strip()
        review.seller_response = response_text[:2000] if response_text else None
        review.seller_response_at = datetime.utcnow() if response_text else None
        db.commit()

    referer = request.headers.get("referer")
    if referer:
        return RedirectResponse(referer, status_code=303)
    return RedirectResponse("/seller/", status_code=303)


@router.post("/{review_id}/delete")
def delete_review(review_id: int, request: Request, db: Session = Depends(get_db)):
    """Удалить свой отзыв"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    review = db.query(Review).filter(
        Review.id == review_id,
        Review.user_id == user.id
    ).first()
    if review:
        db.delete(review)
        db.commit()

    return RedirectResponse("/order/orders", status_code=303)
