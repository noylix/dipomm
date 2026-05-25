# routes/analytics.py
# Аналитика для администратора

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Order, OrderItem, Product, User, Delivery, Review, Complaint
from auth import get_optional_user, check_role
from marketplace_utils import effective_product_price_expr

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


@router.get("/")
def analytics_page(
    request: Request,
    db: Session = Depends(get_db),
    date_from: str = "",
    date_to: str = "",
):
    """Страница аналитики для админа/менеджера"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    parsed_from = None
    parsed_to = None
    if date_from:
        try:
            parsed_from = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            parsed_from = None
    if date_to:
        try:
            parsed_to = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            parsed_to = None
    if parsed_to:
        parsed_to = parsed_to.replace(hour=23, minute=59, second=59)

    orders_scope = db.query(Order)
    if parsed_from:
        orders_scope = orders_scope.filter(Order.created_at >= parsed_from)
    if parsed_to:
        orders_scope = orders_scope.filter(Order.created_at <= parsed_to)

    # Общая статистика
    total_orders = orders_scope.count()
    total_revenue = orders_scope.with_entities(func.sum(Order.total_price)).scalar() or 0
    total_platform_fee = orders_scope.with_entities(func.sum(Order.platform_fee)).scalar() or 0
    avg_order_value = orders_scope.with_entities(func.avg(Order.total_price)).scalar() or 0

    # Заказы по статусам
    orders_by_status_q = db.query(Order.status, func.count(Order.id))
    if parsed_from:
        orders_by_status_q = orders_by_status_q.filter(Order.created_at >= parsed_from)
    if parsed_to:
        orders_by_status_q = orders_by_status_q.filter(Order.created_at <= parsed_to)
    orders_by_status = orders_by_status_q.group_by(Order.status).all()
    orders_by_status = {s: c for s, c in orders_by_status}

    # Топ-5 товаров по количеству в заказах
    top_products_q = (
        db.query(
            Product.name,
            func.sum(OrderItem.quantity).label("qty")
        )
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, Order.id == OrderItem.order_id)
    )
    if parsed_from:
        top_products_q = top_products_q.filter(Order.created_at >= parsed_from)
    if parsed_to:
        top_products_q = top_products_q.filter(Order.created_at <= parsed_to)
    top_products = (
        top_products_q
        .group_by(Product.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )

    # Топ-5 фермеров по выручке (по проданным товарам)
    top_sellers_q = (
        db.query(
            User.email,
            func.sum(OrderItem.quantity * effective_product_price_expr(Product)).label("revenue")
        )
        .join(Product, Product.owner_id == User.id)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(User.role == "seller")
    )
    if parsed_from:
        top_sellers_q = top_sellers_q.filter(Order.created_at >= parsed_from)
    if parsed_to:
        top_sellers_q = top_sellers_q.filter(Order.created_at <= parsed_to)
    top_sellers = (
        top_sellers_q
        .group_by(User.id)
        .order_by(func.sum(OrderItem.quantity * effective_product_price_expr(Product)).desc())
        .limit(5)
        .all()
    )

    # Жалобы по статусам
    complaints_by_status_q = db.query(Complaint.status, func.count(Complaint.id))
    if parsed_from:
        complaints_by_status_q = complaints_by_status_q.filter(Complaint.created_at >= parsed_from)
    if parsed_to:
        complaints_by_status_q = complaints_by_status_q.filter(Complaint.created_at <= parsed_to)
    complaints_by_status = complaints_by_status_q.group_by(Complaint.status).all()
    complaints_by_status = {s: c for s, c in complaints_by_status}

    return request.app.state.templates.TemplateResponse(
        request, "analytics",
        {
            "user": user,
            "total_orders": total_orders,
            "total_revenue": round(float(total_revenue), 2),
            "total_platform_fee": round(float(total_platform_fee), 2),
            "avg_order_value": round(float(avg_order_value), 2),
            "orders_by_status": orders_by_status,
            "top_products": top_products,
            "top_sellers": top_sellers,
            "complaints_by_status": complaints_by_status,
            "date_from": date_from,
            "date_to": date_to,
        }
    )


@router.get("/export.csv")
def analytics_export_csv(
    db: Session = Depends(get_db),
    date_from: str = "",
    date_to: str = "",
):
    parsed_from = None
    parsed_to = None
    if date_from:
        try:
            parsed_from = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            parsed_from = None
    if date_to:
        try:
            parsed_to = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            parsed_to = None

    query = db.query(Order).order_by(Order.created_at.desc(), Order.id.desc())
    if parsed_from:
        query = query.filter(Order.created_at >= parsed_from)
    if parsed_to:
        query = query.filter(Order.created_at <= parsed_to)

    rows = query.limit(5000).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["order_id", "created_at", "status", "payment_status", "total_price", "platform_fee"])
    for order in rows:
        writer.writerow([
            order.id,
            order.created_at.isoformat() if order.created_at else "",
            order.status or "",
            order.payment_status or "",
            float(order.total_price or 0),
            float(order.platform_fee or 0),
        ])
    buffer.seek(0)
    filename = "analytics_orders.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
