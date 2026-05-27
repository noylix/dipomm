# routes/admin.py
# Административные функции (только admin и manager)

from datetime import datetime
from pathlib import Path
import zipfile

from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from database import DATABASE_URL, get_db
from models import Notification, Order, OrderItem, PlatformSetting, Product, User
from auth import get_optional_user, check_role
from marketplace_utils import product_stock_quantity
from order_statuses import ORDER_STATUSES, ORDER_STATUS_BADGES, ORDER_STATUS_LABELS, is_valid_order_status, normalize_order_status

router = APIRouter(prefix="/admin", tags=["admin"])

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKUPS_DIR = PROJECT_ROOT / "backups"
UPLOADS_DIR = PROJECT_ROOT / "static" / "uploads"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

FARMER_APPLICATION_STATUSES = (
    "pending",
    "approved",
    "rejected",
)
FARMER_APPLICATION_STATUS_LABELS = {
    "pending": "На проверке",
    "approved": "Одобрена",
    "rejected": "Отклонена",
    # Совместимость со старыми значениями
    "new": "На проверке",
    "in_progress": "На проверке",
    "waiting_documents": "На проверке",
}


def _sqlite_database_path() -> Path | None:
    prefix = "sqlite:///"
    if not DATABASE_URL.startswith(prefix):
        return None
    return Path(DATABASE_URL[len(prefix):]).resolve()


def _collect_backups() -> list[dict[str, object]]:
    if not BACKUPS_DIR.exists():
        return []

    backups: list[dict[str, object]] = []
    for archive in sorted(BACKUPS_DIR.glob("*.zip"), key=lambda path: path.stat().st_mtime, reverse=True):
        stat_result = archive.stat()
        backups.append({
            "name": archive.name,
            "size": stat_result.st_size,
            "created_at": datetime.fromtimestamp(stat_result.st_mtime),
        })
    return backups


def _create_backup_archive() -> Path:
    db_path = _sqlite_database_path()
    if not db_path or not db_path.exists():
        raise FileNotFoundError("Файл базы данных не найден.")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    archive_path = BACKUPS_DIR / f"backup-{timestamp}.zip"

    with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(db_path, arcname=f"database/{db_path.name}")

        if UPLOADS_DIR.exists():
            for file_path in UPLOADS_DIR.rglob("*"):
                if file_path.is_file():
                    archive.write(file_path, arcname=f"uploads/{file_path.relative_to(UPLOADS_DIR).as_posix()}")

    return archive_path


@router.get("/")
def admin_page(request: Request, db: Session = Depends(get_db)):
    """Главная админ-панель: коммуникации (admin и manager)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    from models import Complaint, Review
    commission_setting = db.query(PlatformSetting).filter(PlatformSetting.key == "platform_commission_percent").first()
    stats = {
        "complaints_new": db.query(Complaint).filter(Complaint.status == "new").count(),
        "reviews_pending": db.query(Review).filter(Review.status == "pending").count(),
        "products_pending": db.query(Product).filter(Product.status == "pending").count(),
        "orders_total": db.query(Order).count(),
        "users_total": db.query(User).filter(User.role == "user").count(),
        "sellers_total": db.query(User).filter(User.role == "seller").count(),
        "products_total": db.query(Product).count(),
        "revenue_total": float(db.query(func.coalesce(func.sum(Order.total_price), 0)).scalar() or 0),
        "platform_fee_total": float(db.query(func.coalesce(func.sum(Order.platform_fee), 0)).scalar() or 0),
        "commission_percent": commission_setting.value if commission_setting else "7",
    }
    return request.app.state.templates.TemplateResponse(
        request, "communications_admin", {"user": user, "stats": stats}
    )


@router.get("/backups")
def admin_backups_page(request: Request, db: Session = Depends(get_db)):
    """Резервное копирование — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    return request.app.state.templates.TemplateResponse(
        request,
        "backups",
        {
            "user": user,
            "backups": _collect_backups(),
            "backup_success": request.session.pop("backup_success", None),
            "backup_error": request.session.pop("backup_error", None),
        },
    )


@router.post("/backups/create")
def admin_create_backup(request: Request, db: Session = Depends(get_db)):
    """Создать ZIP-архив с базой и загрузками."""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    try:
        archive_path = _create_backup_archive()
        request.session["backup_success"] = f"Резервная копия создана: {archive_path.name}"
    except Exception as exc:
        request.session["backup_error"] = f"Не удалось создать резервную копию: {exc}"
    return RedirectResponse(url="/admin/backups", status_code=303)


@router.get("/manage")
def admin_manage_page(request: Request, db: Session = Depends(get_db)):
    """Управление товарами и пользователями — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    products = db.query(Product).all()
    users = db.query(User).all()
    orders = db.query(Order).order_by(Order.id.desc()).limit(50).all()
    return request.app.state.templates.TemplateResponse(
        request, "admin", {
            "products": products,
            "users": users,
            "orders": orders,
            "order_statuses": ORDER_STATUSES,
            "status_labels": ORDER_STATUS_LABELS,
            "status_badges": ORDER_STATUS_BADGES,
            "user": user,
            "admin_error": request.session.pop("admin_error", None),
            "admin_success": request.session.pop("admin_success", None),
        }
    )


@router.post("/order/status/{order_id}")
def admin_change_order_status(
    order_id: int,
    request: Request,
    status: str = Form(...),
    db: Session = Depends(get_db)
):
    """Изменить статус заказа — только admin."""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    if not is_valid_order_status(status):
        request.session["admin_error"] = "Недопустимый статус заказа."
        return RedirectResponse(url="/admin/manage", status_code=303)

    desired_status = normalize_order_status(status)
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        request.session["admin_error"] = "Заказ не найден."
        return RedirectResponse(url="/admin/manage", status_code=303)

    previous_status = normalize_order_status(order.status)
    is_paid = order.payment_status == "paid"
    paid_only_statuses = {"paid", "confirmed", "assembling", "ready_for_pickup", "ready_for_delivery", "in_delivery", "delivered", "received", "completed"}

    if desired_status in paid_only_statuses and not is_paid:
        request.session["admin_error"] = "Нельзя перевести заказ в оплаченный этап без платежа."
        return RedirectResponse(url="/admin/manage", status_code=303)
    if desired_status == "refunded":
        request.session["admin_error"] = "Возврат оформляется через бухгалтерию, чтобы создать транзакцию и вернуть деньги."
        return RedirectResponse(url="/admin/manage", status_code=303)
    if desired_status == "cancelled" and is_paid:
        request.session["admin_error"] = "Оплаченный заказ нельзя просто отменить: используйте возврат через бухгалтерию."
        return RedirectResponse(url="/admin/manage", status_code=303)

    order.status = desired_status
    if desired_status == "completed" and is_paid:
        order.escrow_status = "released"
    if desired_status == "cancelled" and previous_status not in ("cancelled", "refunded"):
        for item in order.items or []:
            if item.product and item.quantity:
                item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)
    db.commit()
    request.session["admin_success"] = f"Статус заказа #{order.id} обновлен."
    return RedirectResponse(url="/admin/manage", status_code=303)


@router.get("/moderation")
def admin_moderation_page(request: Request, db: Session = Depends(get_db)):
    """Модерация товаров и продавцов — для admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    pending_products = (
        db.query(Product)
        .options(joinedload(Product.owner))
        .filter(Product.status == "pending")
        .order_by(Product.id.desc())
        .all()
    )
    products = (
        db.query(Product)
        .options(joinedload(Product.owner))
        .filter(Product.status != "pending")
        .order_by(Product.id.desc())
        .all()
    )
    users = db.query(User).all()
    farmer_applications = (
        db.query(User)
        .filter(User.role == "seller")
        .order_by(User.id.desc())
        .all()
    )
    pending_sellers = [
        seller for seller in farmer_applications
        if (seller.seller_application_status or "pending") != "approved"
    ]
    approved_sellers = [
        seller for seller in farmer_applications
        if (seller.seller_application_status or "pending") == "approved"
    ]
    return request.app.state.templates.TemplateResponse(
        request, "manager",
        {
            "pending_products": pending_products,
            "products": products,
            "users": users,
            "pending_sellers": pending_sellers,
            "approved_sellers": approved_sellers,
            "farmer_applications": farmer_applications,
            "farmer_application_statuses": FARMER_APPLICATION_STATUSES,
            "farmer_application_status_labels": FARMER_APPLICATION_STATUS_LABELS,
            "user": user,
        }
    )


@router.post("/product/approve/{product_id}")
def admin_approve_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Одобрить товар — admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard
    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        product.status = "approved"
        product.rejection_reason = None
        db.commit()
        # Уведомление продавцу
        if product.owner_id:
            from models import Notification
            db.add(Notification(
                user_id=product.owner_id, type="system",
                subject="Товар одобрен",
                body=f'Ваш товар "{product.name}" одобрен и опубликован в каталоге.'
            ))
            db.commit()
    return RedirectResponse(url="/admin/moderation", status_code=303)


@router.post("/product/reject/{product_id}")
def admin_reject_product(
    product_id: int,
    request: Request,
    reason: str = Form(""),
    db: Session = Depends(get_db)
):
    """Отклонить товар — admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard
    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        product.status = "rejected"
        product.rejection_reason = reason or "Не соответствует правилам платформы"
        db.commit()
        if product.owner_id:
            from models import Notification
            db.add(Notification(
                user_id=product.owner_id, type="system",
                subject="Товар отклонён",
                body=f'Ваш товар "{product.name}" отклонён. Причина: {product.rejection_reason}'
            ))
            db.commit()
    return RedirectResponse(url="/admin/moderation", status_code=303)


@router.post("/product/delete/{product_id}")
def admin_delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Удалить товар — admin или manager (модерация)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        db.delete(product)
        db.commit()
    redirect_to = "/admin/manage" if user.role == "admin" else "/admin/moderation"
    return RedirectResponse(url=redirect_to, status_code=303)


@router.post("/user/role/{user_id}")
def admin_change_role(
    user_id: int,
    request: Request,
    role: str = Form(...),
    db: Session = Depends(get_db)
):
    """Изменить роль пользователя — только admin"""
    me = get_optional_user(request, db)
    guard = check_role(me, ["admin"])
    if guard:
        return guard

    if role in ("user", "seller", "manager", "admin", "accountant"):
        target = db.query(User).filter(User.id == user_id).first()
        if target:
            if target.id == me.id and role != "admin":
                request.session["admin_error"] = "Нельзя снять роль администратора у текущей учетной записи."
                return RedirectResponse(url="/admin/manage", status_code=303)
            if target.role == "admin" and role != "admin":
                admins_count = db.query(User).filter(User.role == "admin").count()
                if admins_count <= 1:
                    request.session["admin_error"] = "Нельзя снять роль у последнего администратора."
                    return RedirectResponse(url="/admin/manage", status_code=303)
            target.role = role
            # При повышении до seller — авто-одобрение, чтобы товары были видимы
            if role == "seller":
                target.is_approved = 1
                target.seller_application_status = "approved"
            db.commit()
            request.session["admin_success"] = "Роль пользователя обновлена."
    return RedirectResponse(url="/admin/manage", status_code=303)


@router.post("/settings/commission")
def admin_update_commission(
    request: Request,
    commission_percent: str = Form("7"),
    db: Session = Depends(get_db),
):
    me = get_optional_user(request, db)
    guard = check_role(me, ["admin"])
    if guard:
        return guard

    try:
        value = max(0, min(100, float(str(commission_percent).replace(",", "."))))
    except ValueError:
        value = 7.0
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "platform_commission_percent").first()
    if not setting:
        setting = PlatformSetting(key="platform_commission_percent", value=str(value))
        db.add(setting)
    else:
        setting.value = str(value)
    db.commit()
    return RedirectResponse("/admin/", status_code=303)


@router.post("/farmer-application/{user_id}/status")
def admin_update_farmer_application(
    user_id: int,
    request: Request,
    status: str = Form(...),
    comment: str = Form(""),
    db: Session = Depends(get_db),
):
    me = get_optional_user(request, db)
    guard = check_role(me, ["admin", "manager"])
    if guard:
        return guard

    normalized_status = (status or "").strip()
    if normalized_status in ("new", "in_progress", "waiting_documents", ""):
        normalized_status = "pending"
    if normalized_status not in FARMER_APPLICATION_STATUSES:
        normalized_status = "pending"

    target = db.query(User).filter(User.id == user_id, User.role == "seller").first()
    if target:
        clean_comment = (comment or "").strip()
        target.seller_application_status = normalized_status
        target.is_approved = 1 if normalized_status == "approved" else 0
        target.seller_application_admin_comment = clean_comment or None
        target.seller_application_rejection_reason = clean_comment if normalized_status == "rejected" else None
        db.add(Notification(
            user_id=target.id,
            type="system",
            subject="Статус заявки фермера обновлен",
            body=(
                f"Статус вашей заявки: {FARMER_APPLICATION_STATUS_LABELS.get(normalized_status, normalized_status)}."
                + (f" Комментарий: {clean_comment}" if clean_comment else "")
            ),
        ))
        db.commit()
    return RedirectResponse(url="/admin/moderation", status_code=303)


@router.post("/user/approve/{user_id}")
def admin_approve_seller(
    user_id: int,
    request: Request,
    approved: int = Form(...),
    db: Session = Depends(get_db)
):
    """Одобрить или заблокировать фермера — admin или manager"""
    me = get_optional_user(request, db)
    guard = check_role(me, ["admin", "manager"])
    if guard:
        return guard

    target = db.query(User).filter(User.id == user_id, User.role == "seller").first()
    if target:
        target.is_approved = 1 if approved else 0
        target.seller_application_status = "approved" if approved else "rejected"
        target.seller_application_rejection_reason = None if approved else "Анкета отклонена администратором."
        db.add(Notification(
            user_id=target.id,
            type="system",
            subject="Статус анкеты фермера обновлен",
            body="Анкета одобрена. Теперь вы можете войти и пользоваться функциями фермера."
            if approved
            else "Анкета отклонена. Свяжитесь с администратором и обновите данные анкеты при необходимости.",
        ))
        db.commit()
    redirect_to = "/admin/manage" if me.role == "admin" else "/admin/moderation"
    return RedirectResponse(url=redirect_to, status_code=303)
