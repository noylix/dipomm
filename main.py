# main.py
# Точка входа в фермерский маркетплейс

from fastapi import FastAPI, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from base64 import b64decode
from itsdangerous import BadSignature, TimestampSigner
import json
from database import engine, Base, get_db, SessionLocal
from models import User, Product, Review, SellerReview, Coupon, Notification, Order, OrderItem, FarmCertificate, PlatformSetting
from auth import hash_password, get_optional_user
from sqlalchemy import inspect, text
from datetime import date, datetime
from decimal import Decimal
from urllib.parse import quote_plus
from config import AUTO_SEED_DEMO_DATA, SESSION_SECRET_KEY as CONFIGURED_SESSION_SECRET_KEY
from marketplace_utils import effective_product_price_expr, product_price_payload, product_stock_payload

# Импорт роутеров
from routes import cart, order, delivery, admin, users, seller, complaints, reviews, analytics, notifications, product, favorites, payment, search, chat, accounting, conversations


def _is_displayable_text(value):
    return bool(value and str(value).strip() and "?" not in str(value))

# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

# Лёгкая миграция: добавляем недостающие колонки в существующие таблицы (SQLite)
def _migrate_schema():
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    # Миграция products
    if "products" in table_names:
        cols = {c["name"] for c in inspector.get_columns("products")}
        with engine.begin() as conn:
            if "stock" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0"))
            if "unit" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN unit VARCHAR(50) DEFAULT '\u0448\u0442'"))
            if "low_stock_threshold" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 0"))
            if "image_url" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(500)"))
            if "discount_price" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN discount_price NUMERIC(10,2)"))
            if "status" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN status VARCHAR(50) DEFAULT 'approved'"))
                conn.execute(text("UPDATE products SET status = 'approved' WHERE status IS NULL"))
            if "rejection_reason" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN rejection_reason VARCHAR(500)"))
            if "description" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN description VARCHAR(4000)"))
            if "expiration_days" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN expiration_days INTEGER"))
            if "has_certificate" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN has_certificate INTEGER DEFAULT 0"))
            if "region" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN region VARCHAR(200)"))
            conn.execute(text("UPDATE products SET stock = 0 WHERE stock IS NULL"))
            conn.execute(text("UPDATE products SET unit = '\u0448\u0442' WHERE unit IS NULL OR unit = ''"))
            conn.execute(text("UPDATE products SET low_stock_threshold = 0 WHERE low_stock_threshold IS NULL"))

    # Миграция users
    if "users" in table_names:
        cols = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            for col, ddl in [
                ("email_verified",   "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"),
                ("verification_token","ALTER TABLE users ADD COLUMN verification_token VARCHAR(255)"),
                ("password_reset_token", "ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255)"),
                ("password_reset_expires_at", "ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME"),
                ("full_name",        "ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"),
                ("farm_name",        "ALTER TABLE users ADD COLUMN farm_name VARCHAR(255)"),
                ("phone",            "ALTER TABLE users ADD COLUMN phone VARCHAR(50)"),
                ("inn",              "ALTER TABLE users ADD COLUMN inn VARCHAR(20)"),
                ("farm_address",     "ALTER TABLE users ADD COLUMN farm_address VARCHAR(500)"),
                ("farm_description", "ALTER TABLE users ADD COLUMN farm_description VARCHAR(2000)"),
                ("farm_photo_url",   "ALTER TABLE users ADD COLUMN farm_photo_url VARCHAR(500)"),
                ("passport_photo_url", "ALTER TABLE users ADD COLUMN passport_photo_url VARCHAR(500)"),
                ("seller_application_status", "ALTER TABLE users ADD COLUMN seller_application_status VARCHAR(50) DEFAULT 'approved'"),
                ("seller_application_rejection_reason", "ALTER TABLE users ADD COLUMN seller_application_rejection_reason VARCHAR(2000)"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
            # Тестовые пользователи считаются подтверждёнными
            conn.execute(text("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0"))
            conn.execute(text(
                "UPDATE users SET seller_application_status = CASE "
                "WHEN role = 'seller' AND is_approved = 1 THEN 'approved' "
                "WHEN role = 'seller' AND is_approved = 0 THEN 'pending' "
                "ELSE COALESCE(seller_application_status, 'approved') END "
                "WHERE seller_application_status IS NULL OR seller_application_status = ''"
            ))

    # Миграция transactions
    if "transactions" in table_names:
        cols = {c["name"] for c in inspector.get_columns("transactions")}
        with engine.begin() as conn:
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id INTEGER"))
            conn.execute(text(
                "UPDATE transactions "
                "SET user_id = (SELECT wallets.user_id FROM wallets WHERE wallets.id = transactions.wallet_id) "
                "WHERE user_id IS NULL"
            ))

    # Миграция reviews
    if "reviews" in table_names:
        cols = {c["name"] for c in inspector.get_columns("reviews")}
        with engine.begin() as conn:
            if "seller_response" not in cols:
                conn.execute(text("ALTER TABLE reviews ADD COLUMN seller_response VARCHAR(2000)"))
            if "seller_response_at" not in cols:
                conn.execute(text("ALTER TABLE reviews ADD COLUMN seller_response_at DATETIME"))

    if "farm_certificates" in table_names:
        cols = {c["name"] for c in inspector.get_columns("farm_certificates")}
        with engine.begin() as conn:
            if "image_url" not in cols:
                conn.execute(text("ALTER TABLE farm_certificates ADD COLUMN image_url VARCHAR(500)"))

    if "deliveries" in table_names:
        cols = {c["name"] for c in inspector.get_columns("deliveries")}
        with engine.begin() as conn:
            for col, ddl in [
                ("provider", "ALTER TABLE deliveries ADD COLUMN provider VARCHAR(100)"),
                ("external_id", "ALTER TABLE deliveries ADD COLUMN external_id VARCHAR(100)"),
                ("track_number", "ALTER TABLE deliveries ADD COLUMN track_number VARCHAR(100)"),
                ("tracking_url", "ALTER TABLE deliveries ADD COLUMN tracking_url VARCHAR(500)"),
                ("status", "ALTER TABLE deliveries ADD COLUMN status VARCHAR(50) DEFAULT 'created'"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))

    # Order checkout fields
    if "orders" in table_names:
        cols = {c["name"] for c in inspector.get_columns("orders")}
        with engine.begin() as conn:
            for col, ddl in [
                ("order_number", "ALTER TABLE orders ADD COLUMN order_number VARCHAR(40)"),
                ("customer_name", "ALTER TABLE orders ADD COLUMN customer_name VARCHAR(255)"),
                ("customer_phone", "ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50)"),
                ("delivery_address", "ALTER TABLE orders ADD COLUMN delivery_address VARCHAR(500)"),
                ("delivery_method", "ALTER TABLE orders ADD COLUMN delivery_method VARCHAR(50)"),
                ("delivery_slot", "ALTER TABLE orders ADD COLUMN delivery_slot VARCHAR(100)"),
                ("customer_comment", "ALTER TABLE orders ADD COLUMN customer_comment VARCHAR(2000)"),
                ("selected_payment_method", "ALTER TABLE orders ADD COLUMN selected_payment_method VARCHAR(50)"),
                ("seller_cancel_reason", "ALTER TABLE orders ADD COLUMN seller_cancel_reason VARCHAR(2000)"),
                ("delivery_fee", "ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0"),
                ("payout_status", "ALTER TABLE orders ADD COLUMN payout_status VARCHAR(50) DEFAULT 'pending'"),
                ("payout_confirmed_at", "ALTER TABLE orders ADD COLUMN payout_confirmed_at DATETIME"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE orders SET order_number = 'FM-' || strftime('%Y%m%d', COALESCE(created_at, 'now')) || '-' || printf('%05d', id) WHERE order_number IS NULL OR order_number = ''"))
            conn.execute(text("UPDATE orders SET payout_status = 'pending' WHERE payout_status IS NULL OR payout_status = ''"))

    if "complaints" in table_names:
        cols = {c["name"] for c in inspector.get_columns("complaints")}
        with engine.begin() as conn:
            if "order_id" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN order_id INTEGER"))
            if "category" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN category VARCHAR(100) DEFAULT 'other'"))
            if "assigned_to_role" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN assigned_to_role VARCHAR(50) DEFAULT 'admin'"))
            if "attachment_path" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN attachment_path VARCHAR(500)"))
            if "admin_response" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN admin_response VARCHAR(2000)"))
            if "updated_at" not in cols:
                conn.execute(text("ALTER TABLE complaints ADD COLUMN updated_at DATETIME"))

    if "users" in table_names:
        cols = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            for col, ddl in [
                ("supplier_registration_data", "ALTER TABLE users ADD COLUMN supplier_registration_data VARCHAR(1000)"),
                ("supplier_document_url", "ALTER TABLE users ADD COLUMN supplier_document_url VARCHAR(500)"),
                ("supplier_bank_details", "ALTER TABLE users ADD COLUMN supplier_bank_details VARCHAR(1000)"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))

_migrate_schema()

# Создаем приложение FastAPI
app = FastAPI(title="Свои Ряды")

# Подключаем сессии (для cookie-based auth)
SESSION_SECRET_KEY = CONFIGURED_SESSION_SECRET_KEY or "change-me-in-production-please"
SESSION_COOKIE_NAME = "session"
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET_KEY)


def _read_session_user_id(request: Request):
    cookie_value = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_value:
        return None
    try:
        signer = TimestampSigner(str(SESSION_SECRET_KEY))
        raw_data = signer.unsign(cookie_value.encode("utf-8"))
        session_data = json.loads(b64decode(raw_data))
    except (BadSignature, ValueError, TypeError, json.JSONDecodeError):
        return None
    return session_data.get("user_id")


@app.middleware("http")
async def role_gate(request: Request, call_next):
    path = request.url.path or "/"
    if path.startswith("/static") or path == "/logout":
        return await call_next(request)

    user_id = _read_session_user_id(request)
    if not user_id:
        return await call_next(request)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()

    if not user:
        return await call_next(request)

    allowed_prefixes = {
        "user": [
            "/",
            "/about",
            "/delivery",
            "/business",
            "/quality",
            "/blog",
            "/recipes",
            "/bonus",
            "/catalog",
            "/search",
            "/product/",
            "/cart/",
            "/favorites/",
            "/order/",
            "/payment/",
            "/profile",
            "/chat/order/",
            "/notifications/",
            "/complaints/",
            "/complaints/create",
            "/complaints/my",
            "/conversations",
            "/conversations/",
            "/reviews/product/",
            "/become-seller",
            "/verify-email",
        ],
        "seller": [
            "/seller/",
            "/order/",
            "/chat/order/",
            "/conversations",
            "/conversations/",
            "/seller/support",
            "/delivery/track/",
            "/product/",
            "/reviews/product/",
            "/notifications/",
            "/logout",
        ],
        "admin": [
            "/admin/",
            "/delivery/track/",
            "/reviews/admin",
            "/complaints/admin",
            "/notifications/admin",
            "/admin/analytics/",
            "/admin/moderation",
            "/admin/manage",
            "/logout",
        ],
        "accountant": [
            "/accounting/",
            "/accounting/requests",
            "/logout",
        ],
    }

    role_home = {
        "accountant": "/accounting/",
        "admin": "/admin/",
        "seller": "/seller/",
    }.get(user.role)
    allowed = allowed_prefixes.get(user.role, [])
    if role_home and not any(path == prefix or path.startswith(prefix) for prefix in allowed):
        return RedirectResponse(url=role_home, status_code=303)

    return await call_next(request)

# Подключаем статику и шаблоны
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
app.state.templates = templates


_original_template_response = Jinja2Templates.TemplateResponse


_MODEL_RELATIONS = {
    "Product": ("owner",),
    "CartItem": ("product",),
    "Order": ("user", "items", "delivery", "coupon"),
    "OrderItem": ("product",),
    "Review": ("user", "product", "order"),
    "SellerReview": ("user", "seller", "order"),
    "Favorite": ("product",),
    "Wallet": ("transactions",),
    "Transaction": ("order",),
    "Complaint": ("author", "target_user", "target_product", "order"),
    # Keep this acyclic for JSON export to React.
    "Conversation": ("buyer", "farmer", "admin", "accountant", "order", "product", "complaint"),
    "Message": ("sender",),
    "ChatMessage": ("author", "recipient"),
}


def _json_safe(value, depth=0, cache=None):
    """Convert route context values into JSON for the React UI."""
    if cache is None:
        cache = {}
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _json_safe(v, depth + 1, cache) for k, v in value.items() if k != "request"}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v, depth + 1, cache) for v in value]
    if hasattr(value, "_mapping"):
        return {str(k): _json_safe(v, depth + 1, cache) for k, v in value._mapping.items()}
    if hasattr(value, "__table__"):
        obj_id = (value.__class__.__name__, getattr(value, "id", id(value)))
        if obj_id in cache:
            return cache[obj_id]

        data = {}
        cache[obj_id] = data
        skip_columns = {"password_hash", "verification_token"}
        for column in value.__table__.columns:
            if column.name in skip_columns:
                continue
            data[column.name] = _json_safe(getattr(value, column.name), depth + 1, cache)
        for extra in ("_seller_rating", "_sold_count", "_review_count"):
            if hasattr(value, extra):
                data[extra[1:]] = _json_safe(getattr(value, extra), depth + 1, cache)
        if value.__class__.__name__ == "Product":
            data.update(product_price_payload(value))
            data.update(product_stock_payload(value))
        for rel in _MODEL_RELATIONS.get(value.__class__.__name__, ()):
            try:
                data[rel] = _json_safe(getattr(value, rel), depth + 1, cache)
            except Exception:
                pass
        return data
    return str(value)


def _react_template_response(self, *args, **kwargs):
    request = kwargs.get("request")
    template_name = kwargs.get("name")
    context = kwargs.get("context")

    if args:
        if hasattr(args[0], "scope"):
            request = args[0]
            template_name = args[1] if len(args) > 1 else template_name
            context = args[2] if len(args) > 2 else context
        else:
            template_name = args[0]
            context = args[1] if len(args) > 1 else context
            if isinstance(context, dict):
                request = context.get("request", request)

    if template_name == "react.html" or request is None:
        return _original_template_response(self, *args, **kwargs)

    context = dict(context or {})
    page = str(template_name).replace("\\", "/").rsplit(".", 1)[0]
    payload = _json_safe(context)
    react_context = {
        "request": request,
        "page": page,
        "props": payload,
        "title": "Свои Ряды",
    }
    return _original_template_response(self, request, "react.html", react_context)


Jinja2Templates.TemplateResponse = _react_template_response

# Подключаем роутеры
app.include_router(users.router)
app.include_router(cart.router)
app.include_router(order.router)
app.include_router(delivery.router)
app.include_router(seller.router)
app.include_router(complaints.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(product.router)
app.include_router(admin.router)
app.include_router(favorites.router)
app.include_router(payment.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(accounting.router)
app.include_router(conversations.router)


def init_test_data():
    # Создаем тестовые данные при первом запуске.
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add_all([
                User(email="admin@farm.local", password_hash=hash_password("admin123"), role="admin"),
                User(email="seller@farm.local", password_hash=hash_password("seller123"), role="seller", is_approved=1, seller_application_status="approved"),
                User(email="user@farm.local", password_hash=hash_password("user123"), role="user"),
                User(email="manager@farm.local", password_hash=hash_password("manager123"), role="manager"),
                User(email="misha@farm.local", password_hash=hash_password("misha123"), role="admin"),
                User(email="brovin@farm.local", password_hash=hash_password("brovin123"), role="accountant"),
            ])
            db.commit()

        if not db.query(User).filter(User.email == "misha@farm.local").first():
            db.add(User(email="misha@farm.local", password_hash=hash_password("misha123"), role="admin"))
            db.commit()
        if not db.query(User).filter(User.email == "brovin@farm.local").first():
            db.add(User(email="brovin@farm.local", password_hash=hash_password("brovin123"), role="accountant"))
            db.commit()

        if not db.query(PlatformSetting).filter(PlatformSetting.key == "platform_commission_percent").first():
            db.add(PlatformSetting(key="platform_commission_percent", value="7"))
            db.commit()

        if not db.query(Product).first():
            seller_obj = db.query(User).filter(User.role == "seller").first()
            seller_id = seller_obj.id if seller_obj else 1
            demo_products = [
                Product(name="Яблоки сезонные", price=120.0, discount_price=99.0, owner_id=seller_id, category="Фрукты", variety="Гала", weight_per_unit="1 кг", expiration_days=30, has_certificate=1, region="Краснодарский край", stock=50),
                Product(name="Картофель молодой", price=45.0, discount_price=39.0, owner_id=seller_id, category="Овощи", variety="Невский", weight_per_unit="5 кг", expiration_days=90, has_certificate=0, region="Ленинградская область", stock=200),
                Product(name="Молоко фермерское", price=85.0, discount_price=75.0, owner_id=seller_id, category="Молоко", variety="Цельное", weight_per_unit="1 л", expiration_days=7, has_certificate=1, region="Московская область", stock=30),
                Product(name="Яйца домашние", price=90.0, discount_price=79.0, owner_id=seller_id, category="Яйца", variety="Куриные", weight_per_unit="10 шт", expiration_days=21, has_certificate=1, region="Тульская область", stock=100),
                Product(name="Мед натуральный", price=450.0, owner_id=seller_id, category="Мёд", variety="Липовый", weight_per_unit="0.5 л", expiration_days=730, has_certificate=1, region="Алтайский край", stock=20),
                Product(name="Огурцы свежие", price=70.0, owner_id=seller_id, category="Овощи", variety="Кураж", weight_per_unit="1 кг", expiration_days=14, has_certificate=0, region="Краснодарский край", stock=80),
            ]
            demo_units = ["\u043a\u0433", "\u043a\u0433", "\u043b", "\u0448\u0442", "\u0431\u0430\u043d\u043a\u0430", "\u043a\u0433"]
            for index, product in enumerate(demo_products):
                product.status = "approved"
                product.unit = demo_units[index] if index < len(demo_units) else "\u0448\u0442"
                product.low_stock_threshold = 5
                db.add(product)
            db.commit()

        seller_obj = db.query(User).filter(User.role == "seller").first()
        if seller_obj:
            seller_obj.is_approved = 1
            seller_obj.seller_application_status = seller_obj.seller_application_status or "approved"
            seller_obj.farm_name = seller_obj.farm_name or "Ферма Петровых"
            seller_obj.farm_description = seller_obj.farm_description or "Семейное хозяйство с овощами, молоком, яйцами и сезонными продуктами."
            seller_obj.farm_photo_url = seller_obj.farm_photo_url or "https://images.unsplash.com/photo-1517758478390-c89333af4642?auto=format&fit=crop&fm=jpg&q=60&w=1200"
            db.commit()

        if not db.query(FarmCertificate).first() and seller_obj:
            db.add_all([
                FarmCertificate(seller_id=seller_obj.id, title="Сертификат качества молочной продукции", image_url="https://images.unsplash.com/photo-1452378174528-3090a4bba7b2?auto=format&fit=crop&fm=jpg&q=60&w=1200"),
                FarmCertificate(seller_id=seller_obj.id, title="Сертификат на экологическое производство", image_url="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=jpg&q=60&w=1200"),
            ])
            db.commit()

        if not db.query(Coupon).first():
            db.add(Coupon(code="FARM10", discount_percent=10, min_order=500, is_active=1))
            db.commit()
    finally:
        db.close()


# Заполняем тестовые данные
if AUTO_SEED_DEMO_DATA:
    init_test_data()


@app.get("/")
def index(
    request: Request,
    db: Session = Depends(get_db),
    q: str = "",
):
    """Главная страница со списком товаров."""
    if (q or "").strip():
        return RedirectResponse(url=f"/search?q={quote_plus((q or '').strip())}", status_code=303)

    # Считаем рейтинг фермеров: средняя оценка по одобренным отзывам
    subq = (
        db.query(
            Review.user_id.label("seller_id"),
            func.avg(Review.rating).label("avg_rating")
        )
        .filter(Review.status == "approved")
        .group_by(Review.user_id)
        .subquery()
    )

    query = db.query(Product, subq.c.avg_rating).outerjoin(
        subq, Product.owner_id == subq.c.seller_id
    )

    # Только одобренные товары и от подтверждённых фермеров
    query = query.join(User, Product.owner_id == User.id).filter(
        Product.status == "approved",
        or_(User.is_approved == 1, Product.owner_id == None)
    )

    # Сортировка: сначала по рейтингу фермера (NULL = 0), потом по id
    query = query.order_by(func.coalesce(subq.c.avg_rating, 0).desc(), Product.id)
    rows = query.all()

    products = []
    for row in rows:
        product = row[0]
        product._seller_rating = round(row[1], 1) if row[1] else None
        products.append(product)

    user = get_optional_user(request, db)
    return templates.TemplateResponse(
        request, "index", {
            "products": products, "user": user,
            "q": q,
        }
    )


@app.get("/about")
def about(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "about", {"user": user})


@app.get("/delivery")
def delivery(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "delivery", {"user": user})


@app.get("/business")
def business(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "business", {"user": user})


@app.get("/reviews")
def reviews_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "reviews", {"user": user})


@app.get("/recipes")
def recipes_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "recipes", {"user": user})


@app.get("/quality")
def quality_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "quality", {"user": user})


@app.get("/blog")
def blog_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "blog", {"user": user})


@app.get("/bonus")
def bonus_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return templates.TemplateResponse(request, "bonus", {"user": user})


@app.get("/catalog")
def catalog_page(
    request: Request,
    db: Session = Depends(get_db),
    category: str = "",
    sort: str = "rating",
    page: int = 1,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock: str = "",
    has_certificate: str = "",
):
    """Страница каталога с фильтрацией по категории и сортировкой"""
    # Считаем рейтинг фермеров
    rating_subq = (
        db.query(
            Review.user_id.label("seller_id"),
            func.avg(Review.rating).label("avg_rating")
        )
        .filter(Review.status == "approved")
        .group_by(Review.user_id)
        .subquery()
    )

    popularity_subq = (
        db.query(
            OrderItem.product_id.label("product_id"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("sold_count")
        )
        .group_by(OrderItem.product_id)
        .subquery()
    )

    query = db.query(Product, rating_subq.c.avg_rating, popularity_subq.c.sold_count).outerjoin(
        rating_subq, Product.owner_id == rating_subq.c.seller_id
    ).outerjoin(
        popularity_subq, Product.id == popularity_subq.c.product_id
    )

    # Только одобренные товары и от подтверждённых фермеров
    query = query.join(User, Product.owner_id == User.id).filter(
        Product.status == "approved",
        or_(User.is_approved == 1, Product.owner_id == None)
    )

    # Фильтр по категории
    if category:
        category_map = {
            'молоко': 'Молоко',
            'мясо': 'Мясо',
            'курица': 'Мясо',
            'овощи': 'Овощи',
            'фрукты': 'Фрукты',
            'сладости': 'Сладости',
            'бакалея': 'Бакалея',
            'хлеб': 'Хлеб',
            'консервы': 'Консервы',
            'заморозка': 'Замороженные',
            'напитки': 'Напитки',
            'сыр': 'Сыр',
            'яйца': 'Яйца',
            'мёд': 'Мёд'
        }
        cat_lower = category.lower()
        if cat_lower in category_map:
            query = query.filter(Product.category == category_map[cat_lower])
        elif cat_lower == "new" and sort == "rating":
            sort = "newest"
        elif cat_lower == "popular" and sort == "rating":
            sort = "popular"

    effective_price = effective_product_price_expr(Product)
    if min_price is not None and min_price >= 0:
        query = query.filter(effective_price >= min_price)
    if max_price is not None and max_price >= 0:
        query = query.filter(effective_price <= max_price)
    if in_stock == "1":
        query = query.filter(Product.stock > 0)
    if has_certificate == "1":
        query = query.filter(Product.has_certificate == 1)

    allowed_sorts = {"price_asc", "price_desc", "rating", "newest", "popular"}
    if sort not in allowed_sorts:
        sort = "rating"

    if sort == "price_asc":
        query = query.order_by(effective_price.asc(), Product.id.desc())
    elif sort == "price_desc":
        query = query.order_by(effective_price.desc(), Product.id.desc())
    elif sort == "newest":
        query = query.order_by(Product.id.desc())
    elif sort == "popular":
        query = query.order_by(func.coalesce(popularity_subq.c.sold_count, 0).desc(), Product.id.desc())
    else:
        query = query.order_by(func.coalesce(rating_subq.c.avg_rating, 0).desc(), Product.id.desc())

    per_page = 24
    page = max(page, 1)
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    products = []
    for row in rows:
        product = row[0]
        product._seller_rating = round(row[1], 1) if row[1] else None
        product._sold_count = int(row[2] or 0)
        products.append(product)

    user = get_optional_user(request, db)
    total_pages = (total + per_page - 1) // per_page
    return templates.TemplateResponse(
        request, "catalog", {
            "products": products,
            "user": user,
            "category": category,
            "sort": sort,
            "page_num": page,
            "total_pages": total_pages,
            "min_price": min_price,
            "max_price": max_price,
            "in_stock": in_stock,
            "has_certificate": has_certificate,
        }
    )
