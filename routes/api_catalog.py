# routes/api_catalog.py
# REST API модуля управления каталогом продукции (документация: /docs)

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from auth import get_optional_user
from database import get_db
from marketplace_utils import normalize_product_unit, product_price_payload, product_stock_payload
from models import Notification, Product, User
from routes.seller import _clean_product_payload

router = APIRouter(prefix="/api", tags=["Каталог"])

CATALOG_CATEGORIES: list[str] = [
    "Овощи",
    "Фрукты",
    "Ягоды",
    "Молоко",
    "Сыры",
    "Мясо",
    "Птица",
    "Яйца",
    "Мёд",
    "Хлеб",
    "Бакалея",
    "Напитки",
    "Консервы",
    "Заморозка",
    "Сладости",
    "Другое",
]


def _require_user(request: Request, db: Session) -> User:
    user = get_optional_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    return user


def _require_roles(user: User, roles: list[str]) -> None:
    if user.role not in roles:
        raise HTTPException(status_code=403, detail="Недостаточно прав")


def _product_to_dict(product: Product, *, include_owner: bool = False) -> dict:
    payload = {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "price": float(product.price),
        "discount_price": float(product.discount_price) if product.discount_price else None,
        "status": product.status,
        "rejection_reason": product.rejection_reason,
        "variety": product.variety,
        "region": product.region,
        "description": product.description,
        "image_url": product.image_url,
        "owner_id": product.owner_id,
        **product_price_payload(product),
        **product_stock_payload(product),
    }
    if include_owner and product.owner:
        payload["owner"] = {
            "id": product.owner.id,
            "farm_name": product.owner.farm_name,
            "full_name": product.owner.full_name,
        }
    return payload


class ProductCreate(BaseModel):
    """Тело запроса на добавление товара в каталог."""

    name: str = Field(..., min_length=1, max_length=255, examples=["Молоко фермерское 3,2%"])
    price: float = Field(..., gt=0, examples=[120.0])
    category: str = Field(default="Другое", max_length=100, examples=["Молоко"])
    discount_price: float | None = Field(default=None, ge=0)
    stock: int = Field(default=0, ge=0)
    unit: str = Field(default="шт", max_length=50)
    low_stock_threshold: int = Field(default=0, ge=0)
    variety: str | None = None
    region: str | None = None
    description: str | None = Field(default=None, max_length=4000)
    expiration_days: int = Field(default=0, ge=0)
    image_url: str | None = None


class ProductUpdate(BaseModel):
    """Обновление карточки или модерация (поле status — только admin/manager)."""

    name: str | None = Field(default=None, max_length=255)
    price: float | None = Field(default=None, gt=0)
    category: str | None = Field(default=None, max_length=100)
    discount_price: float | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = None
    variety: str | None = None
    region: str | None = None
    description: str | None = Field(default=None, max_length=4000)
    status: Literal["pending", "approved", "rejected"] | None = None
    rejection_reason: str | None = Field(default=None, max_length=500)


class StockUpdate(BaseModel):
    stock: int = Field(..., ge=0, description="Новый остаток на складе")
    low_stock_threshold: int | None = Field(default=None, ge=0)


@router.get(
    "/categories",
    summary="Список категорий каталога",
    description="Возвращает фиксированный классификатор категорий товаров маркетплейса.",
)
def api_list_categories():
    return {"categories": CATALOG_CATEGORIES}


@router.get(
    "/products",
    summary="Список товаров",
    description="Публичный список одобренных товаров; продавец и админ могут фильтровать по статусу.",
)
def api_list_products(
    request: Request,
    db: Session = Depends(get_db),
    status: str | None = Query(default=None, description="pending | approved | rejected"),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=24, ge=1, le=100),
):
    user = get_optional_user(request, db)
    query = db.query(Product).options(joinedload(Product.owner))

    if user and user.role in ("admin", "manager"):
        if status:
            query = query.filter(Product.status == status)
    elif user and user.role == "seller":
        query = query.filter(Product.owner_id == user.id)
        if status:
            query = query.filter(Product.status == status)
    else:
        query = query.join(User, Product.owner_id == User.id).filter(
            Product.status == "approved",
            User.is_approved == 1,
        )

    if category:
        query = query.filter(Product.category == category)

    total = query.count()
    rows = (
        query.order_by(Product.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [_product_to_dict(row) for row in rows],
    }


@router.post(
    "/products",
    summary="Добавить товар",
    description="Создание карточки продавцом; статус pending (у admin — сразу approved).",
    status_code=201,
)
def api_create_product(
    body: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _require_user(request, db)
    _require_roles(user, ["seller", "admin", "manager"])
    if user.role == "seller" and not user.is_approved:
        raise HTTPException(status_code=403, detail="Аккаунт продавца не подтверждён")

    is_valid, error = _clean_product_payload(
        body.name,
        body.price,
        body.discount_price,
        body.category,
        body.expiration_days,
        body.stock,
        body.unit,
        body.low_stock_threshold,
        body.description or "",
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    unit = normalize_product_unit(body.unit, body.category)
    initial_status = "approved" if user.role in ("admin", "manager") else "pending"

    product = Product(
        name=body.name.strip(),
        price=body.price,
        discount_price=body.discount_price,
        owner_id=user.id,
        category=body.category,
        variety=body.variety,
        region=body.region,
        stock=body.stock,
        unit=unit,
        low_stock_threshold=body.low_stock_threshold,
        description=body.description,
        expiration_days=body.expiration_days if body.expiration_days > 0 else None,
        image_url=body.image_url,
        has_certificate=1,
        status=initial_status,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_dict(product)


@router.get(
    "/products/{product_id}",
    summary="Карточка товара",
    description="Детальная информация о товаре по идентификатору.",
)
def api_get_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .options(joinedload(Product.owner))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    user = get_optional_user(request, db)
    if product.status != "approved":
        is_owner = user and product.owner_id == user.id
        is_staff = user and user.role in ("admin", "manager")
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="Товар не найден")

    return _product_to_dict(product, include_owner=True)


@router.patch(
    "/products/{product_id}",
    summary="Изменить товар / модерация",
    description="Продавец обновляет поля карточки (статус снова pending). "
    "Администратор может установить status=approved|rejected для модерации.",
)
def api_update_product(
    product_id: int,
    body: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _require_user(request, db)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    is_admin = user.role in ("admin", "manager")
    is_owner = user.role == "seller" and product.owner_id == user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # --- Модерация (только admin/manager) ---
    if body.status is not None:
        if not is_admin:
            raise HTTPException(status_code=403, detail="Модерация доступна только администратору")
        if body.status == "approved":
            product.status = "approved"
            product.rejection_reason = None
            notify_subject = "Товар одобрен"
            notify_body = f'Ваш товар "{product.name}" одобрен и опубликован в каталоге.'
        elif body.status == "rejected":
            product.status = "rejected"
            product.rejection_reason = body.rejection_reason or "Не соответствует правилам платформы"
            notify_subject = "Товар отклонён"
            notify_body = f'Ваш товар "{product.name}" отклонён. Причина: {product.rejection_reason}'
        else:
            product.status = "pending"
            product.rejection_reason = None
            notify_subject = notify_body = None

        if product.owner_id and notify_subject:
            db.add(
                Notification(
                    user_id=product.owner_id,
                    type="system",
                    subject=notify_subject,
                    body=notify_body,
                )
            )

    if body.name is not None:
        product.name = body.name.strip()
    if body.price is not None:
        product.price = body.price
    if body.discount_price is not None:
        product.discount_price = body.discount_price
    if body.category is not None:
        product.category = body.category
    if body.stock is not None:
        product.stock = body.stock
    if body.unit is not None or body.category is not None:
        product.unit = normalize_product_unit(
            body.unit or product.unit,
            body.category or product.category,
        )
    if body.variety is not None:
        product.variety = body.variety
    if body.region is not None:
        product.region = body.region
    if body.description is not None:
        product.description = body.description

    if is_owner and body.status is None:
        product.status = "pending"
        product.rejection_reason = None

    db.commit()
    db.refresh(product)
    return _product_to_dict(product)


@router.patch(
    "/products/{product_id}/stock",
    summary="Обновить остаток",
    description="Изменение количества товара на складе и порога низкого остатка.",
)
def api_update_stock(
    product_id: int,
    body: StockUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _require_user(request, db)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    is_admin = user.role in ("admin", "manager")
    is_owner = user.role == "seller" and product.owner_id == user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    product.stock = body.stock
    if body.low_stock_threshold is not None:
        product.low_stock_threshold = body.low_stock_threshold

    db.commit()
    db.refresh(product)
    return product_stock_payload(product) | {"id": product.id, "name": product.name}
