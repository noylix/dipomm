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
from models import User, Product, Review, SellerReview, Coupon, OrderItem, FarmCertificate, PlatformSetting
from auth import hash_password, get_optional_user
from sqlalchemy import inspect, text
from datetime import date, datetime
from decimal import Decimal
from urllib.parse import quote_plus
from config import AUTO_SEED_DEMO_DATA, SESSION_SECRET_KEY as CONFIGURED_SESSION_SECRET_KEY
from marketplace_utils import (
    effective_product_price_expr,
    product_not_on_sale_clause,
    product_on_sale_clause,
    product_price_payload,
    product_stock_payload,
)
from seed_demo_catalog import seed_extended_demo_catalog

# Импорт роутеров
from routes import cart, order, delivery, admin, users, seller, complaints, reviews, analytics, notifications, product, favorites, payment, search, chat, accounting, conversations, api_catalog, finance_admin


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
            conn.execute(
                text(
                    "UPDATE products SET unit = '\u0448\u0442' "
                    "WHERE lower(unit) IN ('\u043b', '\u043b\u0438\u0442\u0440', '\u0431\u0430\u043d\u043a\u0430', "
                    "'\u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0430', '\u043f\u0443\u0447\u043e\u043a', '\u043a\u043e\u0440\u043e\u0431\u043a\u0430') "
                    "AND category NOT IN ('\u041e\u0432\u043e\u0449\u0438', '\u0424\u0440\u0443\u043a\u0442\u044b', '\u042f\u0433\u043e\u0434\u044b', '\u0417\u0435\u043b\u0435\u043d\u044c')"
                )
            )
            conn.execute(
                text(
                    "UPDATE products SET unit = '\u043a\u0433' "
                    "WHERE category IN ('\u041e\u0432\u043e\u0449\u0438', '\u0424\u0440\u0443\u043a\u0442\u044b', '\u042f\u0433\u043e\u0434\u044b', '\u0417\u0435\u043b\u0435\u043d\u044c') "
                    "AND (unit IS NULL OR unit = '' OR lower(unit) IN ('\u043b', '\u043b\u0438\u0442\u0440', '\u0431\u0430\u043d\u043a\u0430', "
                    "'\u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0430', '\u043f\u0443\u0447\u043e\u043a', '\u043a\u043e\u0440\u043e\u0431\u043a\u0430', '\u0448\u0442'))"
                )
            )
            conn.execute(
                text(
                    "UPDATE products SET weight_per_unit = '1 \u0448\u0442' "
                    "WHERE weight_per_unit IS NOT NULL AND ("
                    "lower(weight_per_unit) LIKE '%\u043b%' OR lower(weight_per_unit) LIKE '%\u043b\u0438\u0442%' "
                    "OR lower(weight_per_unit) LIKE '%\u0431\u0430\u043d\u043a%'"
                    ") AND category NOT IN ('\u041e\u0432\u043e\u0449\u0438', '\u0424\u0440\u0443\u043a\u0442\u044b', '\u042f\u0433\u043e\u0434\u044b', '\u0417\u0435\u043b\u0435\u043d\u044c')"
                )
            )
            conn.execute(text("UPDATE products SET low_stock_threshold = 0 WHERE low_stock_threshold IS NULL"))
            conn.execute(text("UPDATE products SET has_certificate = 1 WHERE has_certificate IS NULL OR has_certificate = 0"))

    if "product_images" not in table_names:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE product_images ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, "
                    "image_url VARCHAR(500) NOT NULL, "
                    "sort_order INTEGER DEFAULT 0)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO product_images (product_id, image_url, sort_order) "
                    "SELECT p.id, p.image_url, 0 FROM products p "
                    "WHERE p.image_url IS NOT NULL AND TRIM(p.image_url) != '' "
                    "AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)"
                )
            )

    # Миграция users
    if "users" in table_names:
        cols = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            for col, ddl in [
                ("email_verified",   "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"),
                ("verification_token","ALTER TABLE users ADD COLUMN verification_token VARCHAR(255)"),
                ("password_reset_token", "ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255)"),
                ("password_reset_expires_at", "ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME"),
                ("min_order_amount", "ALTER TABLE users ADD COLUMN min_order_amount NUMERIC(10, 2) DEFAULT 0"),
                ("created_at", "ALTER TABLE users ADD COLUMN created_at DATETIME"),
                ("full_name",        "ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"),
                ("farm_name",        "ALTER TABLE users ADD COLUMN farm_name VARCHAR(255)"),
                ("phone",            "ALTER TABLE users ADD COLUMN phone VARCHAR(50)"),
                ("inn",              "ALTER TABLE users ADD COLUMN inn VARCHAR(20)"),
                ("farm_address",     "ALTER TABLE users ADD COLUMN farm_address VARCHAR(500)"),
                ("farm_description", "ALTER TABLE users ADD COLUMN farm_description VARCHAR(2000)"),
                ("product_categories", "ALTER TABLE users ADD COLUMN product_categories VARCHAR(1000)"),
                ("farm_photo_url",   "ALTER TABLE users ADD COLUMN farm_photo_url VARCHAR(500)"),
                ("passport_photo_url", "ALTER TABLE users ADD COLUMN passport_photo_url VARCHAR(500)"),
                ("supplier_registration_data", "ALTER TABLE users ADD COLUMN supplier_registration_data VARCHAR(1000)"),
                ("supplier_document_url", "ALTER TABLE users ADD COLUMN supplier_document_url VARCHAR(500)"),
                ("supplier_bank_details", "ALTER TABLE users ADD COLUMN supplier_bank_details VARCHAR(1000)"),
                ("seller_application_status", "ALTER TABLE users ADD COLUMN seller_application_status VARCHAR(50) DEFAULT 'approved'"),
                ("seller_application_number", "ALTER TABLE users ADD COLUMN seller_application_number VARCHAR(40)"),
                ("seller_application_rejection_reason", "ALTER TABLE users ADD COLUMN seller_application_rejection_reason VARCHAR(2000)"),
                ("seller_application_admin_comment", "ALTER TABLE users ADD COLUMN seller_application_admin_comment VARCHAR(2000)"),
                ("pickup_enabled", "ALTER TABLE users ADD COLUMN pickup_enabled INTEGER DEFAULT 1"),
                ("pickup_address", "ALTER TABLE users ADD COLUMN pickup_address VARCHAR(500)"),
                ("pickup_comment", "ALTER TABLE users ADD COLUMN pickup_comment VARCHAR(1000)"),
                ("farmer_delivery_enabled", "ALTER TABLE users ADD COLUMN farmer_delivery_enabled INTEGER DEFAULT 1"),
                ("farmer_delivery_fee", "ALTER TABLE users ADD COLUMN farmer_delivery_fee NUMERIC(10, 2) DEFAULT 500"),
                ("farmer_delivery_min_order", "ALTER TABLE users ADD COLUMN farmer_delivery_min_order NUMERIC(10, 2) DEFAULT 0"),
                ("farmer_delivery_comment", "ALTER TABLE users ADD COLUMN farmer_delivery_comment VARCHAR(1000)"),
                ("delivery_slots", "ALTER TABLE users ADD COLUMN delivery_slots VARCHAR(1000)"),
                ("partner_delivery_enabled", "ALTER TABLE users ADD COLUMN partner_delivery_enabled INTEGER DEFAULT 0"),
                ("partner_delivery_fee", "ALTER TABLE users ADD COLUMN partner_delivery_fee NUMERIC(10, 2) DEFAULT 700"),
                ("partner_delivery_comment", "ALTER TABLE users ADD COLUMN partner_delivery_comment VARCHAR(1000)"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
                    cols.add(col)
            # Тестовые пользователи считаются подтверждёнными
            # Demo accounts are treated as verified; do not verify real registered users on every startup.
            conn.execute(text(
                "UPDATE users SET email_verified = 1 "
                "WHERE email IN ("
                "'admin@farm.local', 'seller@farm.local', 'user@farm.local', "
                "'manager@farm.local', 'misha@farm.local', 'brovin@farm.local', "
                "'buyer1@farm.local', 'buyer2@farm.local', 'buyer3@farm.local'"
                ") AND (email_verified IS NULL OR email_verified = 0)"
            ))
            conn.execute(text(
                "UPDATE users SET seller_application_status = CASE "
                "WHEN role = 'seller' AND is_approved = 1 THEN 'approved' "
                "WHEN role = 'seller' AND is_approved = 0 THEN 'pending' "
                "ELSE COALESCE(seller_application_status, 'approved') END "
                "WHERE seller_application_status IS NULL OR seller_application_status = ''"
            ))
            # Унифицируем статусы заявок фермеров: pending / approved / rejected
            conn.execute(text(
                "UPDATE users SET seller_application_status = 'pending' "
                "WHERE role = 'seller' AND COALESCE(seller_application_status, '') "
                "NOT IN ('approved', 'rejected')"
            ))
            conn.execute(text(
                "UPDATE users SET seller_application_status = 'approved' "
                "WHERE role = 'seller' AND is_approved = 1 "
                "AND seller_application_status = 'pending'"
            ))
            conn.execute(text(
                "UPDATE users SET seller_application_number = 'ZF-' || strftime('%Y%m%d', 'now') || '-' || printf('%05d', id) "
                "WHERE role = 'seller' "
                "AND (seller_application_number IS NULL OR seller_application_number = '')"
            ))
            conn.execute(text("UPDATE users SET pickup_enabled = 1 WHERE role = 'seller' AND pickup_enabled IS NULL"))
            conn.execute(text("UPDATE users SET farmer_delivery_enabled = 1 WHERE role = 'seller' AND farmer_delivery_enabled IS NULL"))
            conn.execute(text("UPDATE users SET partner_delivery_enabled = 0 WHERE role = 'seller' AND partner_delivery_enabled IS NULL"))
            conn.execute(text("UPDATE users SET farmer_delivery_fee = 500 WHERE role = 'seller' AND farmer_delivery_fee IS NULL"))
            conn.execute(text("UPDATE users SET partner_delivery_fee = 700 WHERE role = 'seller' AND partner_delivery_fee IS NULL"))
            conn.execute(text("UPDATE users SET delivery_slots = '10-14,14-18,18-22' WHERE role = 'seller' AND (delivery_slots IS NULL OR delivery_slots = '')"))
    # Миграция transactions
    if "wallets" in table_names:
        cols = {c["name"] for c in inspector.get_columns("wallets")}
        with engine.begin() as conn:
            if "account_type" not in cols:
                conn.execute(text("ALTER TABLE wallets ADD COLUMN account_type VARCHAR(20) DEFAULT 'seller'"))
            if "held_balance" not in cols:
                conn.execute(text("ALTER TABLE wallets ADD COLUMN held_balance NUMERIC(10,2) DEFAULT 0"))
            conn.execute(text("UPDATE wallets SET account_type = 'seller' WHERE account_type IS NULL OR account_type = ''"))
            conn.execute(text("UPDATE wallets SET held_balance = 0 WHERE held_balance IS NULL"))

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
    if "cart_items" in table_names:
        indexes = inspector.get_indexes("cart_items")
        has_cart_unique_index = any(
            index.get("unique")
            and list(index.get("column_names") or []) == ["user_id", "product_id"]
            for index in indexes
        )
        with engine.begin() as conn:
            conn.execute(text(
                "DELETE FROM cart_items "
                "WHERE id NOT IN ("
                "SELECT min_id FROM ("
                "SELECT MIN(id) AS min_id FROM cart_items GROUP BY user_id, product_id"
                ") AS keepers)"
            ))
            if not has_cart_unique_index:
                conn.execute(text(
                    "CREATE UNIQUE INDEX uq_cart_items_user_product "
                    "ON cart_items (user_id, product_id)"
                ))

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
                ("provider_name", "ALTER TABLE deliveries ADD COLUMN provider_name VARCHAR(100)"),
                ("external_id", "ALTER TABLE deliveries ADD COLUMN external_id VARCHAR(100)"),
                ("track_number", "ALTER TABLE deliveries ADD COLUMN track_number VARCHAR(100)"),
                ("tracking_url", "ALTER TABLE deliveries ADD COLUMN tracking_url VARCHAR(500)"),
                ("status", "ALTER TABLE deliveries ADD COLUMN status VARCHAR(50) DEFAULT 'created'"),
                ("delivery_slot", "ALTER TABLE deliveries ADD COLUMN delivery_slot VARCHAR(100)"),
                ("comment", "ALTER TABLE deliveries ADD COLUMN comment VARCHAR(2000)"),
                ("delivery_fee", "ALTER TABLE deliveries ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
                    cols.add(col)
            conn.execute(text("UPDATE deliveries SET delivery_fee = 0 WHERE delivery_fee IS NULL"))

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
                ("payment_id", "ALTER TABLE orders ADD COLUMN payment_id VARCHAR(255)"),
                ("paid_at", "ALTER TABLE orders ADD COLUMN paid_at DATETIME"),
                ("payment_amount", "ALTER TABLE orders ADD COLUMN payment_amount NUMERIC(10,2)"),
                ("seller_cancel_reason", "ALTER TABLE orders ADD COLUMN seller_cancel_reason VARCHAR(2000)"),
                ("delivery_fee", "ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0"),
                ("payout_status", "ALTER TABLE orders ADD COLUMN payout_status VARCHAR(50) DEFAULT 'pending'"),
                ("payout_confirmed_at", "ALTER TABLE orders ADD COLUMN payout_confirmed_at DATETIME"),
                ("delivered_at", "ALTER TABLE orders ADD COLUMN delivered_at DATETIME"),
                ("buyer_confirmed_at", "ALTER TABLE orders ADD COLUMN buyer_confirmed_at DATETIME"),
                ("auto_release_at", "ALTER TABLE orders ADD COLUMN auto_release_at DATETIME"),
                ("escrow_released_at", "ALTER TABLE orders ADD COLUMN escrow_released_at DATETIME"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE orders SET order_number = 'FM-' || strftime('%Y%m%d', COALESCE(created_at, 'now')) || '-' || printf('%05d', id) WHERE order_number IS NULL OR order_number = ''"))
            conn.execute(text("UPDATE orders SET payout_status = 'pending' WHERE payout_status IS NULL OR payout_status = ''"))
            conn.execute(text("UPDATE orders SET status = 'awaiting_payment' WHERE status = 'created' AND COALESCE(payment_status, 'pending') = 'pending'"))

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
            # Унифицируем статусы жалоб: new / in_progress / resolved / rejected
            # (sent_to_accountant остаётся системным для передачи бухгалтеру)
            conn.execute(text(
                "UPDATE complaints SET status = 'in_progress' "
                "WHERE status IN ('processing', 'waiting_farmer')"
            ))
            conn.execute(text(
                "UPDATE complaints SET status = 'resolved' WHERE status = 'closed'"
            ))
            # type — легаси-поле, дублирует category. Заполняем category из type, где пусто.
            conn.execute(text(
                "UPDATE complaints SET category = type "
                "WHERE (category IS NULL OR category = '') AND type IS NOT NULL AND type != ''"
            ))
            conn.execute(text(
                "UPDATE complaints SET category = 'other' "
                "WHERE category IS NULL OR category = ''"
            ))

    if "coupons" in table_names:
        cols = {c["name"] for c in inspector.get_columns("coupons")}
        with engine.begin() as conn:
            for col, ddl in [
                ("seller_id", "ALTER TABLE coupons ADD COLUMN seller_id INTEGER"),
                ("title", "ALTER TABLE coupons ADD COLUMN title VARCHAR(255)"),
                ("max_uses", "ALTER TABLE coupons ADD COLUMN max_uses INTEGER"),
            ]:
                if col not in cols:
                    conn.execute(text(ddl))

_migrate_schema()

# Создаем приложение FastAPI
app = FastAPI(
    title="Свои Ряды — маркетплейс",
    description=(
        "Веб-приложение фермерского маркетплейса. "
        "Раздел **Каталог** — REST API модуля управления каталогом продукции "
        "(`/api/products`, `/api/categories`, остатки, модерация)."
    ),
    version="1.0.0",
)

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
async def escrow_auto_release_middleware(request: Request, call_next):
    """Автовыпуск эскроу через 24 ч после доставки."""
    if not (request.url.path or "").startswith("/static"):
        db = SessionLocal()
        try:
            from finance_ledger import process_auto_escrow_releases

            process_auto_escrow_releases(db)
        except Exception:
            db.rollback()
        finally:
            db.close()
    return await call_next(request)


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
            "/payment/wallet",
            "/payment/transactions",
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
            "/admin/backups",
            "/admin/finance",
            "/delivery/track/",
            "/product/",
            "/seller/",
            "/reviews/admin",
            "/complaints/admin",
            "/complaints/status/",
            "/notifications/admin",
            "/admin/analytics/",
            "/admin/moderation",
            "/admin/manage",
            "/logout",
        ],
        "manager": [
            "/admin/moderation",
            "/product/",
            "/seller/",
            "/reviews/admin",
            "/complaints/admin",
            "/complaints/status/",
            "/admin/analytics/",
            "/delivery/track/",
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
        "manager": "/admin/moderation",
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
    "Product": ("owner", "images"),
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
        skip_columns = {
            "password_hash",
            "verification_token",
            "password_reset_token",
            "password_reset_expires_at",
            "email_verified",
            "inn",
            "passport_photo_url",
            "supplier_document_url",
            "supplier_registration_data",
            "supplier_bank_details",
        }
        for column in value.__table__.columns:
            if column.name in skip_columns:
                continue
            data[column.name] = _json_safe(getattr(value, column.name), depth + 1, cache)
        for extra in ("_seller_rating", "_seller_review_count", "_product_rating", "_product_review_count", "_sold_count", "_review_count"):
            if hasattr(value, extra):
                data[extra[1:]] = _json_safe(getattr(value, extra), depth + 1, cache)
        if value.__class__.__name__ == "Product":
            from marketplace_utils import product_image_urls

            data.update(product_price_payload(value))
            data.update(product_stock_payload(value))
            data["image_urls"] = product_image_urls(value)
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
app.include_router(api_catalog.router)
app.include_router(finance_admin.router)


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
            seller_obj = (
                db.query(User)
                .filter(User.email == "seller@farm.local", User.role == "seller")
                .first()
                or db.query(User)
                .filter(User.role == "seller", User.seller_application_status == "approved")
                .first()
            )
            if not seller_obj:
                seller_obj = User(
                    email="seller@farm.local",
                    password_hash=hash_password("seller123"),
                    role="seller",
                    is_approved=1,
                    seller_application_status="approved",
                )
                db.add(seller_obj)
                db.commit()
                db.refresh(seller_obj)
            seller_id = seller_obj.id
            demo_products = [
                Product(name="Яблоки сезонные", price=120.0, discount_price=99.0, owner_id=seller_id, category="Фрукты", variety="Гала", weight_per_unit="1 кг", expiration_days=30, has_certificate=1, region="Краснодарский край", stock=50, image_url="/static/product-images/fruits-berries.jpg"),
                Product(name="Картофель молодой", price=45.0, discount_price=39.0, owner_id=seller_id, category="Овощи", variety="Невский", weight_per_unit="5 кг", expiration_days=90, has_certificate=0, region="Ленинградская область", stock=200, image_url="/static/product-images/green-produce.jpg"),
                Product(name="Молоко фермерское", price=85.0, discount_price=75.0, owner_id=seller_id, category="Молоко", variety="Цельное", weight_per_unit="1 шт", expiration_days=7, has_certificate=1, region="Московская область", stock=30, image_url="/static/product-images/dairy-eggs.jpg"),
                Product(name="Яйца домашние", price=90.0, discount_price=79.0, owner_id=seller_id, category="Яйца", variety="Куриные", weight_per_unit="10 шт", expiration_days=21, has_certificate=1, region="Тульская область", stock=100, image_url="/static/product-images/dairy-eggs.jpg"),
                Product(name="Мед натуральный", price=450.0, owner_id=seller_id, category="Мёд", variety="Липовый", weight_per_unit="1 шт", expiration_days=730, has_certificate=1, region="Алтайский край", stock=20, image_url="/static/product-images/basket-hits.jpg"),
                Product(name="Огурцы свежие", price=70.0, owner_id=seller_id, category="Овощи", variety="Кураж", weight_per_unit="1 кг", expiration_days=14, has_certificate=0, region="Краснодарский край", stock=80, image_url="/static/product-images/vegetables-herbs.jpg"),
                Product(name="Томаты розовые", price=140.0, discount_price=119.0, owner_id=seller_id, category="Овощи", variety="Розовые", weight_per_unit="1 кг", expiration_days=10, has_certificate=0, region="Краснодарский край", stock=65, image_url="/static/product-images/vegetables-herbs.jpg"),
                Product(name="Сыр фермерский", price=520.0, owner_id=seller_id, category="Сыр", variety="Полутвердый", weight_per_unit="300 г", expiration_days=20, has_certificate=1, region="Московская область", stock=18, image_url="/static/product-images/dairy-eggs.jpg"),
            ]
            demo_units = ["\u043a\u0433", "\u043a\u0433", "\u0448\u0442", "\u0448\u0442", "\u0448\u0442", "\u043a\u0433", "\u043a\u0433", "\u0448\u0442"]
            for index, product in enumerate(demo_products):
                product.status = "approved"
                product.unit = demo_units[index] if index < len(demo_units) else "\u0448\u0442"
                product.low_stock_threshold = 5
                db.add(product)
            db.commit()

        seller_obj = db.query(User).filter(User.email == "seller@farm.local", User.role == "seller").first()
        if seller_obj:
            demo_product_images = {
                "Яблоки сезонные": "/static/product-images/fruits-berries.jpg",
                "Картофель молодой": "/static/product-images/green-produce.jpg",
                "Молоко фермерское": "/static/product-images/dairy-eggs.jpg",
                "Яйца домашние": "/static/product-images/dairy-eggs.jpg",
                "Мед натуральный": "/static/product-images/basket-hits.jpg",
                "Огурцы свежие": "/static/product-images/vegetables-herbs.jpg",
            }
            for name, image_url in demo_product_images.items():
                product = db.query(Product).filter(Product.name == name).first()
                if product and not product.image_url:
                    product.image_url = image_url

            extra_demo_products = [
                Product(name="Томаты розовые", price=140.0, discount_price=119.0, owner_id=seller_obj.id, category="Овощи", variety="Розовые", weight_per_unit="1 кг", expiration_days=10, has_certificate=0, region="Краснодарский край", stock=65, unit="кг", low_stock_threshold=5, status="approved", image_url="/static/product-images/vegetables-herbs.jpg"),
                Product(name="Сыр фермерский", price=520.0, owner_id=seller_obj.id, category="Сыр", variety="Полутвердый", weight_per_unit="300 г", expiration_days=20, has_certificate=1, region="Московская область", stock=18, unit="шт", low_stock_threshold=5, status="approved", image_url="/static/product-images/dairy-eggs.jpg"),
            ]
            for product in extra_demo_products:
                if not db.query(Product).filter(Product.name == product.name).first():
                    db.add(product)
            db.commit()

        seller_obj = db.query(User).filter(User.email == "seller@farm.local", User.role == "seller").first()
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

        if not db.query(Review).first():
            demo_review_users = [
                ("buyer1@farm.local", "buyer123"),
                ("buyer2@farm.local", "buyer456"),
                ("buyer3@farm.local", "buyer789"),
            ]
            review_users = {}
            for email, password in demo_review_users:
                user_obj = db.query(User).filter(User.email == email).first()
                if not user_obj:
                    user_obj = User(
                        email=email,
                        password_hash=hash_password(password),
                        role="user",
                        is_approved=1,
                        email_verified=1,
                    )
                    db.add(user_obj)
                    db.flush()
                review_users[email] = user_obj

            product_by_name = {product.name: product for product in db.query(Product).all()}
            demo_review_specs = [
                ("buyer1@farm.local", "Яблоки сезонные", 5, "Очень сочные и свежие яблоки, приятно пахнут и без лишней мякоти.", "Спасибо за отзыв, рады, что яблоки понравились!"),
                ("buyer2@farm.local", "Яблоки сезонные", 4, "Хорошие яблоки, вкус яркий. Пара штук была с небольшим потемнением.", None),
                ("buyer3@farm.local", "Молоко фермерское", 5, "Молоко очень нежное, ребенку зашло отлично. Буду брать ещё.", "Спасибо! Всегда рады видеть вас снова."),
                ("buyer1@farm.local", "Яйца домашние", 5, "Яйца крупные, свежие, желток насыщенный. Видно хорошее качество.", None),
                ("buyer2@farm.local", "Мед натуральный", 5, "Мед густой и ароматный, без лишней сладости. Очень понравился.", "Спасибо за добрые слова!"),
                ("buyer3@farm.local", "Картофель молодой", 4, "Картофель чистый и ровный, удобно чистить. Отлично подошел для запекания.", None),
            ]
            demo_reviews = []
            for email, product_name, rating, text, seller_response in demo_review_specs:
                user_obj = review_users.get(email)
                product_obj = product_by_name.get(product_name)
                if not user_obj or not product_obj:
                    continue
                demo_reviews.append(
                    Review(
                        user_id=user_obj.id,
                        product_id=product_obj.id,
                        rating=rating,
                        text=text,
                        seller_response=seller_response,
                        seller_response_at=datetime.utcnow() if seller_response else None,
                        status="approved",
                    )
                )
            db.add_all(demo_reviews)
            db.commit()

        if not db.query(SellerReview).first():
            seller_obj = db.query(User).filter(User.email == "seller@farm.local", User.role == "seller").first()
            demo_review_users = [
                ("buyer1@farm.local", "buyer123"),
                ("buyer2@farm.local", "buyer456"),
                ("buyer3@farm.local", "buyer789"),
            ]
            seller_reviews = []
            if seller_obj:
                for email, password in demo_review_users:
                    user_obj = db.query(User).filter(User.email == email).first()
                    if not user_obj:
                        user_obj = User(
                            email=email,
                            password_hash=hash_password(password),
                            role="user",
                            is_approved=1,
                            email_verified=1,
                        )
                        db.add(user_obj)
                        db.flush()
                    seller_reviews.append(
                        SellerReview(
                            user_id=user_obj.id,
                            seller_id=seller_obj.id,
                            rating=5 if email != "buyer2@farm.local" else 4,
                            text="Надежный продавец: быстро собирает заказ и аккуратно упаковывает продукты.",
                            status="approved",
                        )
                    )
            db.add_all(seller_reviews)
            db.commit()

        seed_extended_demo_catalog(db)
    finally:
        db.close()


# Заполняем тестовые данные
if AUTO_SEED_DEMO_DATA:
    init_test_data()


HOME_SECTION_LIMIT = 12


def _seller_rating_subquery(db: Session):
    return (
        db.query(
            SellerReview.seller_id.label("seller_id"),
            func.avg(SellerReview.rating).label("seller_rating"),
            func.count(SellerReview.id).label("seller_review_count"),
        )
        .filter(SellerReview.status == "approved")
        .group_by(SellerReview.seller_id)
        .subquery()
    )


def _product_rating_subquery(db: Session):
    return (
        db.query(
            Review.product_id.label("product_id"),
            func.avg(Review.rating).label("product_rating"),
            func.count(Review.id).label("product_review_count"),
        )
        .filter(Review.status == "approved")
        .group_by(Review.product_id)
        .subquery()
    )


def _product_popularity_subquery(db: Session):
    return (
        db.query(
            OrderItem.product_id.label("product_id"),
            func.coalesce(func.sum(OrderItem.quantity), 0).label("sold_count")
        )
        .group_by(OrderItem.product_id)
        .subquery()
    )


def _round_rating(value) -> float | None:
    if value is None:
        return None
    return round(float(value), 1)


def _catalog_sort_rating_expr(product_rating_subq, seller_rating_subq):
    """Сортировка каталога: рейтинг товара, иначе рейтинг фермера, иначе 0 (без отсечения позиций)."""
    return func.coalesce(
        product_rating_subq.c.product_rating,
        seller_rating_subq.c.seller_rating,
        0,
    )


def _home_products_from_rows(rows):
    products = []
    for row in rows:
        product = row[0]
        product._seller_rating = _round_rating(row[1])
        product._seller_review_count = int(row[2] or 0)
        product._product_rating = _round_rating(row[3])
        product._product_review_count = int(row[4] or 0)
        product._sold_count = int(row[5] or 0)
        products.append(product)
    return products


def _home_product_sections(db: Session) -> list[dict]:
    seller_rating_subq = _seller_rating_subquery(db)
    product_rating_subq = _product_rating_subquery(db)
    popularity_subq = _product_popularity_subquery(db)
    base_query = (
        db.query(
            Product,
            seller_rating_subq.c.seller_rating,
            seller_rating_subq.c.seller_review_count,
            product_rating_subq.c.product_rating,
            product_rating_subq.c.product_review_count,
            popularity_subq.c.sold_count,
        )
        .outerjoin(seller_rating_subq, Product.owner_id == seller_rating_subq.c.seller_id)
        .outerjoin(product_rating_subq, Product.id == product_rating_subq.c.product_id)
        .outerjoin(popularity_subq, Product.id == popularity_subq.c.product_id)
        .join(User, Product.owner_id == User.id)
        .filter(
            Product.status == "approved",
            or_(User.is_approved == 1, Product.owner_id == None)
        )
    )

    section_specs = [
        {
            "id": "new",
            "title": "Новинки",
            "text": "Свежие позиции, которые недавно появились на витрине.",
            "href": "/catalog?category=new&sort=newest",
            "icon": "sparkles",
            "products": _home_products_from_rows(
                base_query
                .filter(product_not_on_sale_clause(Product))
                .order_by(Product.id.desc())
                .limit(HOME_SECTION_LIMIT)
                .all()
            ),
        },
        {
            "id": "sale",
            "title": "Зеленые ценники",
            "text": "Товары со скидкой, где новая цена ниже обычной.",
            "href": "/catalog?category=sale",
            "icon": "badge-percent",
            "products": _home_products_from_rows(
                base_query
                .filter(product_on_sale_clause(Product))
                .order_by((Product.price - Product.discount_price).desc(), Product.id.desc())
                .limit(HOME_SECTION_LIMIT)
                .all()
            ),
        },
        {
            "id": "fruits",
            "title": "Фрукты и ягоды",
            "text": "Сезонная полка для сладкого, свежего и к чаю.",
            "href": "/catalog?category=фрукты",
            "icon": "apple",
            "products": _home_products_from_rows(
                base_query
                .filter(Product.category.in_(("Фрукты", "Ягоды")))
                .order_by(Product.id.desc())
                .limit(HOME_SECTION_LIMIT)
                .all()
            ),
        },
        {
            "id": "popular",
            "title": "Хиты",
            "text": "То, что чаще выбирают покупатели и выше оценивают.",
            "href": "/catalog?category=popular&sort=popular",
            "icon": "flame",
            "products": _home_products_from_rows(
                base_query
                .order_by(
                    func.coalesce(popularity_subq.c.sold_count, 0).desc(),
                    func.coalesce(product_rating_subq.c.product_rating, 0).desc(),
                    func.coalesce(seller_rating_subq.c.seller_rating, 0).desc(),
                    Product.id.desc(),
                )
                .limit(HOME_SECTION_LIMIT)
                .all()
            ),
        },
    ]
    return [section for section in section_specs if section["products"]]


@app.get("/")
def index(
    request: Request,
    db: Session = Depends(get_db),
    q: str = "",
):
    """Главная страница со списком товаров."""
    if (q or "").strip():
        return RedirectResponse(url=f"/search?q={quote_plus((q or '').strip())}", status_code=303)

    seller_rating_subq = _seller_rating_subquery(db)
    product_rating_subq = _product_rating_subquery(db)
    popularity_subq = _product_popularity_subquery(db)
    query = (
        db.query(
            Product,
            seller_rating_subq.c.seller_rating,
            seller_rating_subq.c.seller_review_count,
            product_rating_subq.c.product_rating,
            product_rating_subq.c.product_review_count,
            popularity_subq.c.sold_count,
        )
        .outerjoin(seller_rating_subq, Product.owner_id == seller_rating_subq.c.seller_id)
        .outerjoin(product_rating_subq, Product.id == product_rating_subq.c.product_id)
        .outerjoin(popularity_subq, Product.id == popularity_subq.c.product_id)
    )

    # Только одобренные товары и от подтверждённых фермеров
    query = query.join(User, Product.owner_id == User.id).filter(
        Product.status == "approved",
        or_(User.is_approved == 1, Product.owner_id == None)
    )

    query = query.order_by(
        func.coalesce(product_rating_subq.c.product_rating, 0).desc(),
        func.coalesce(seller_rating_subq.c.seller_rating, 0).desc(),
        Product.id.desc(),
    )
    rows = query.all()

    products = []
    for row in rows:
        product = row[0]
        product._seller_rating = _round_rating(row[1])
        product._seller_review_count = int(row[2] or 0)
        product._product_rating = _round_rating(row[3])
        product._product_review_count = int(row[4] or 0)
        product._sold_count = int(row[5] or 0)
        products.append(product)

    user = get_optional_user(request, db)
    return templates.TemplateResponse(
        request, "index", {
            "products": products, "user": user,
            "home_sections": _home_product_sections(db),
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
    min_price: str | None = None,
    max_price: str | None = None,
    in_stock: str = "",
):
    """Страница каталога с фильтрацией по категории и сортировкой"""
    def parse_price_filter(value: str | None) -> float | None:
        if value is None or str(value).strip() == "":
            return None
        try:
            number = float(str(value).replace(",", "."))
        except (TypeError, ValueError):
            return None
        return number if number >= 0 else None

    min_price_value = parse_price_filter(min_price)
    max_price_value = parse_price_filter(max_price)
    category_aliases = {
        "молоко": "Молоко",
        "молочное": "Молоко",
        "молочные": "Молоко",
        "мясо": "Мясо",
        "курица": "Мясо",
        "птица": "Мясо",
        "овощи": "Овощи",
        "овощ": "Овощи",
        "зелень": "Овощи",
        "фрукты": "Фрукты",
        "фрукт": "Фрукты",
        "ягоды": "Фрукты",
        "ягода": "Фрукты",
        "сладости": "Сладости",
        "сладкое": "Сладости",
        "бакалея": "Бакалея",
        "хлеб": "Хлеб",
        "выпечка": "Хлеб",
        "консервы": "Консервы",
        "заморозка": "Замороженные",
        "замороженные": "Замороженные",
        "напитки": "Напитки",
        "сыр": "Сыр",
        "сыры": "Сыр",
        "яйца": "Яйца",
        "яйцо": "Яйца",
        "мёд": "Мёд",
        "мед": "Мёд",
    }
    category = (category or "").strip().lower()
    special_category = category if category in {"new", "popular", "sale"} else ""

    if (
        min_price_value is not None
        and max_price_value is not None
        and min_price_value > max_price_value
    ):
        min_price_value, max_price_value = max_price_value, min_price_value

    seller_rating_subq = _seller_rating_subquery(db)
    product_rating_subq = _product_rating_subquery(db)
    popularity_subq = _product_popularity_subquery(db)

    query = (
        db.query(
            Product,
            seller_rating_subq.c.seller_rating,
            seller_rating_subq.c.seller_review_count,
            product_rating_subq.c.product_rating,
            product_rating_subq.c.product_review_count,
            popularity_subq.c.sold_count,
        )
        .outerjoin(seller_rating_subq, Product.owner_id == seller_rating_subq.c.seller_id)
        .outerjoin(product_rating_subq, Product.id == product_rating_subq.c.product_id)
        .outerjoin(popularity_subq, Product.id == popularity_subq.c.product_id)
    )

    # Только одобренные товары и от подтверждённых фермеров
    query = query.join(User, Product.owner_id == User.id).filter(
        Product.status == "approved",
        or_(User.is_approved == 1, Product.owner_id == None)
    )

    effective_price = effective_product_price_expr(Product)
    if category in category_aliases:
        query = query.filter(Product.category == category_aliases[category])
    elif special_category == "new":
        query = query.filter(product_not_on_sale_clause(Product))
    elif special_category == "sale":
        query = query.filter(product_on_sale_clause(Product))
    elif category and not special_category:
        query = query.filter(func.lower(Product.category) == category)

    if min_price_value is not None:
        query = query.filter(effective_price >= min_price_value)
    if max_price_value is not None:
        query = query.filter(effective_price <= max_price_value)
    if in_stock == "1":
        query = query.filter(Product.stock > 0)
    query = query.filter(Product.has_certificate == 1)

    allowed_sorts = {"price_asc", "price_desc", "rating", "rating_asc", "newest", "popular"}
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
    elif sort == "rating_asc":
        sort_rating = _catalog_sort_rating_expr(product_rating_subq, seller_rating_subq)
        query = query.order_by(sort_rating.asc(), Product.id.asc())
    else:
        sort_rating = _catalog_sort_rating_expr(product_rating_subq, seller_rating_subq)
        query = query.order_by(sort_rating.desc(), Product.id.desc())

    per_page = 24
    page = max(page, 1)
    total = query.count()
    total_pages = (total + per_page - 1) // per_page
    if total_pages and page > total_pages:
        page = total_pages
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    products = []
    for row in rows:
        product = row[0]
        product._seller_rating = _round_rating(row[1])
        product._seller_review_count = int(row[2] or 0)
        product._product_rating = _round_rating(row[3])
        product._product_review_count = int(row[4] or 0)
        product._sold_count = int(row[5] or 0)
        products.append(product)

    user = get_optional_user(request, db)
    return templates.TemplateResponse(
        request, "catalog", {
            "products": products,
            "user": user,
            "category": category,
            "sort": sort,
            "page_num": page,
            "total": total,
            "total_pages": total_pages,
            "min_price": min_price_value,
            "max_price": max_price_value,
            "in_stock": in_stock,
        }
    )
