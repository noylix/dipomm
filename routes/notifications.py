# routes/notifications.py
# Уведомления (Модуль коммуникации и управления сообществом — Жуков Максим)

from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from models import Notification, User
from auth import get_optional_user, check_logged_in, check_role

router = APIRouter(prefix="/notifications", tags=["notifications"])
templates = Jinja2Templates(directory="templates")


def send_notification(db: Session, user_id: int, type: str, subject: str, body: str):
    """Отправить уведомление пользователю"""
    notification = Notification(
        user_id=user_id,
        type=type,
        subject=subject,
        body=body,
        is_read=0
    )
    db.add(notification)
    db.commit()


@router.get("/", response_class=HTMLResponse)
def notifications_list(request: Request, db: Session = Depends(get_db)):
    """Список уведомлений пользователя"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    items = db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    # Отмечаем прочитанными
    return templates.TemplateResponse("notifications", {
        "request": request,
        "notifications": items,
        "user": user
    })


@router.get("/unread-count")
def unread_count(request: Request, db: Session = Depends(get_db)):
    """Количество непрочитанных уведомлений (API)"""
    user = get_optional_user(request, db)
    if not user:
        return {"count": 0}

    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == 0
    ).count()

    return {"count": count}


@router.post("/mark-read/{notification_id}")
def mark_as_read(notification_id: int, request: Request, db: Session = Depends(get_db)):
    """Отметить уведомление как прочитанное"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id
    ).first()
    if notification:
        notification.is_read = 1
        db.commit()

    return RedirectResponse("/notifications/", status_code=303)


@router.post("/mark-all-read")
def mark_all_read(request: Request, db: Session = Depends(get_db)):
    """Отметить все уведомления как прочитанные"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()

    return RedirectResponse("/notifications/", status_code=303)


@router.post("/{notification_id}/delete")
def delete_notification(notification_id: int, request: Request, db: Session = Depends(get_db)):
    """Удалить уведомление"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id
    ).first()
    if notification:
        db.delete(notification)
        db.commit()

    return RedirectResponse("/notifications/", status_code=303)


@router.get("/admin", response_class=HTMLResponse)
def notifications_admin(request: Request, db: Session = Depends(get_db)):
    """Админ-панель уведомлений — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    # Получаем все системные уведомления (user_id = NULL)
    system_notifications = db.query(Notification).filter(
        Notification.user_id.is_(None)
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return templates.TemplateResponse("notifications_admin", {
        "request": request,
        "user": user,
        "notifications": system_notifications
    })


@router.get("/communications", response_class=HTMLResponse)
def communications_admin(request: Request, db: Session = Depends(get_db)):
    """Админ-панель коммуникаций — для модуля коммуникации Жукова"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    from models import Complaint, Review, Product
    stats = {
        "complaints_new": db.query(Complaint).filter(Complaint.status == "new").count(),
        "reviews_pending": db.query(Review).filter(Review.status == "pending").count(),
        "products_pending": db.query(Product).filter(Product.status == "pending").count(),
    }
    return templates.TemplateResponse("communications_admin", {
        "request": request,
        "user": user,
        "stats": stats
    })


@router.post("/admin/create")
def create_system_notification(
    request: Request,
    type: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    db: Session = Depends(get_db)
):
    """Создать системное уведомление для всех пользователей — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    # Создаём системное уведомление (user_id = NULL)
    notification = Notification(
        user_id=None,
        type=type,
        subject=subject,
        body=body,
        is_read=0
    )
    db.add(notification)
    db.commit()

    return RedirectResponse("/notifications/admin", status_code=303)


@router.post("/admin/broadcast")
def broadcast_notification(
    request: Request,
    type: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    target_role: str = Form("all"),
    db: Session = Depends(get_db)
):
    """Отправить уведомление всем пользователям или определённой роли — только admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    # Получаем целевых пользователей
    query = db.query(User)
    if target_role != "all":
        query = query.filter(User.role == target_role)

    users = query.all()

    # Отправляем уведомление каждому пользователю
    for u in users:
        notification = Notification(
            user_id=u.id,
            type=type,
            subject=subject,
            body=body,
            is_read=0
        )
        db.add(notification)

    db.commit()

    return RedirectResponse("/notifications/admin", status_code=303)
