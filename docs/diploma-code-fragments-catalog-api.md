# Фрагменты кода для приложения диплома (модуль каталога)

Источник: `routes/api_catalog.py`. Документация Swagger UI: **http://127.0.0.1:8000/docs** (раздел **Каталог**).

---

## Фрагмент 1. Добавление товара в каталог (`POST /api/products`)

```python
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

    is_valid, error = _clean_product_payload(
        body.name, body.price, body.discount_price, body.category,
        body.expiration_days, body.stock, body.unit,
        body.low_stock_threshold, body.description or "",
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
        stock=body.stock,
        unit=unit,
        status=initial_status,
        has_certificate=1,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_dict(product)
```

**Пример запроса (curl):**

```bash
curl -X POST "http://127.0.0.1:8000/api/products" \
  -H "Content-Type: application/json" \
  -b "session=<cookie>" \
  -d '{"name":"Молоко 3,2%","price":120,"category":"Молоко","stock":50}'
```

---

## Фрагмент 2. Модерация товара (`PATCH /api/products/{id}`)

```python
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
            notify_subject = notify_body = None

        if product.owner_id and notify_subject:
            db.add(Notification(
                user_id=product.owner_id, type="system",
                subject=notify_subject, body=notify_body,
            ))
```

**Пример одобрения:**

```bash
curl -X PATCH "http://127.0.0.1:8000/api/products/5" \
  -H "Content-Type: application/json" \
  -b "session=<cookie_admin>" \
  -d '{"status":"approved"}'
```

**Пример отклонения:**

```bash
curl -X PATCH "http://127.0.0.1:8000/api/products/5" \
  -H "Content-Type: application/json" \
  -b "session=<cookie_admin>" \
  -d '{"status":"rejected","rejection_reason":"Нет фото товара"}'
```

---

## Фрагмент 3. Документация API (FastAPI / OpenAPI)

Регистрация приложения и маршрутов в `main.py`:

```python
app = FastAPI(
    title="Свои Ряды — маркетплейс",
    description=(
        "Веб-приложение фермерского маркетплейса. "
        "Раздел **Каталог** — REST API модуля управления каталогом продукции."
    ),
    version="1.0.0",
)

from routes import api_catalog
app.include_router(api_catalog.router)
```

Роутер каталога с тегом для Swagger:

```python
router = APIRouter(prefix="/api", tags=["Каталог"])

@router.get("/categories", summary="Список категорий каталога")
@router.get("/products", summary="Список товаров")
@router.post("/products", summary="Добавить товар", status_code=201)
@router.get("/products/{product_id}", summary="Карточка товара")
@router.patch("/products/{product_id}", summary="Изменить товар / модерация")
@router.patch("/products/{product_id}/stock", summary="Обновить остаток")
```

### Скриншот Swagger UI

1. Запустите сервер: `uvicorn main:app --host 127.0.0.1 --port 8000`
2. Откройте в браузере: **http://127.0.0.1:8000/docs**
3. Разверните секцию **Каталог** — на скрине должны быть видны:
   - `GET /api/categories`
   - `GET /api/products`
   - `POST /api/products`
   - `GET /api/products/{product_id}`
   - `PATCH /api/products/{product_id}`
   - `PATCH /api/products/{product_id}/stock`

Альтернатива: ReDoc — **http://127.0.0.1:8000/redoc**
