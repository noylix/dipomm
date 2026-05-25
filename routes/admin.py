# routes/admin.py
# Административные функции (только admin и manager)

from fastapi import APIRouter, Depends, Request, Form, UploadFile, File
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Notification, Order, OrderItem, PlatformSetting, Product, User
from auth import get_optional_user, check_role
from marketplace_utils import product_stock_quantity
from routes.seller import _clean_product_payload, _save_product_image
from order_statuses import ORDER_STATUSES, ORDER_STATUS_BADGES, ORDER_STATUS_LABELS, is_valid_order_status, normalize_order_status

router = APIRouter(prefix="/admin", tags=["admin"])


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

    if is_valid_order_status(status):
        order = (
            db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.product))
            .filter(Order.id == order_id)
            .first()
        )
        if order:
            previous_status = normalize_order_status(order.status)
            order.status = status
            if status in ("confirmed", "paid", "assembling", "shipped", "delivering", "completed"):
                order.payment_status = "paid"
            if status == "completed":
                order.escrow_status = "released"
            if status in ("canceled", "refunded") and previous_status not in ("canceled", "refunded"):
                for item in order.items or []:
                    if item.product and item.quantity:
                        item.product.stock = product_stock_quantity(item.product) + int(item.quantity or 0)
            if status == "refunded":
                order.escrow_status = "refunded"
            db.commit()
    return RedirectResponse(url="/admin/manage", status_code=303)


@router.get("/moderation")
def admin_moderation_page(request: Request, db: Session = Depends(get_db)):
    """Модерация товаров и продавцов — для admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
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
    pending_sellers = (
        db.query(User)
        .filter(User.role == "seller", User.seller_application_status == "pending")
        .order_by(User.id.desc())
        .all()
    )
    approved_sellers = (
        db.query(User)
        .filter(User.role == "seller", User.seller_application_status == "approved")
        .order_by(User.id.desc())
        .all()
    )
    return request.app.state.templates.TemplateResponse(
        request, "manager",
        {
            "pending_products": pending_products,
            "products": products,
            "users": users,
            "pending_sellers": pending_sellers,
            "approved_sellers": approved_sellers,
            "user": user,
        }
    )


@router.post("/product/approve/{product_id}")
def admin_approve_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    """Одобрить товар — admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
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
    guard = check_role(user, ["admin"])
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


@router.post("/product/add")
def admin_add_product(
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    discount_price: str = Form(""),
    category: str = Form("Другое"),
    variety: str = Form(""),
    weight_per_unit: str = Form(""),
    expiration_days: int = Form(0),
    has_certificate: int = Form(0),
    region: str = Form(""),
    stock: int = Form(0),
    unit: str = Form("\u0448\u0442"),
    low_stock_threshold: int = Form(0),
    owner_id: int = Form(0),
    description: str = Form(""),
    image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Добавить товар с фото — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    # Если owner_id не указан — товар принадлежит админу
    parsed_discount = None
    if str(discount_price).strip():
        try:
            parsed_discount = float(discount_price)
        except ValueError:
            request.session["admin_error"] = "Скидочная цена должна быть числом."
            return RedirectResponse(url="/admin/manage", status_code=303)

    is_valid, error = _clean_product_payload(
        name,
        price,
        parsed_discount,
        category,
        expiration_days,
        stock,
        unit,
        low_stock_threshold,
        description,
    )
    if not is_valid:
        request.session["admin_error"] = error
        return RedirectResponse(url="/admin/manage", status_code=303)

    product_owner = owner_id if owner_id > 0 else user.id
    if owner_id > 0:
        owner = db.query(User).filter(User.id == owner_id, User.role.in_(("seller", "admin"))).first()
        if not owner:
            request.session["admin_error"] = "Укажите существующего продавца"
            return RedirectResponse(url="/admin/manage", status_code=303)
    image_url = _save_product_image(image)
    product = Product(
        name=name, price=price, discount_price=parsed_discount, owner_id=product_owner,
        category=category, variety=variety or None,
        weight_per_unit=weight_per_unit or None,
        expiration_days=expiration_days if expiration_days > 0 else None,
        has_certificate=has_certificate,
        region=region or None,
        stock=stock,
        unit=(unit or "\u0448\u0442").strip(),
        low_stock_threshold=low_stock_threshold,
        image_url=image_url,
        description=description or None,
        status="approved"
    )
    db.add(product)
    db.commit()
    return RedirectResponse(url="/admin/manage", status_code=303)


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

    if role in ("user", "seller", "admin", "accountant"):
        target = db.query(User).filter(User.id == user_id).first()
        if target:
            target.role = role
            # При повышении до seller — авто-одобрение, чтобы товары были видимы
            if role == "seller":
                target.is_approved = 1
                target.seller_application_status = "approved"
            db.commit()
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


@router.post("/user/approve/{user_id}")
def admin_approve_seller(
    user_id: int,
    request: Request,
    approved: int = Form(...),
    db: Session = Depends(get_db)
):
    """Одобрить или заблокировать фермера — admin или manager"""
    me = get_optional_user(request, db)
    guard = check_role(me, ["admin"])
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
