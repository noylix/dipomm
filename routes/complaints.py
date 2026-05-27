# routes/complaints.py
# Жалобы и споры (Модуль коммуникации и управления сообществом — Жуков Максим)

from fastapi import APIRouter, Depends, Request, Form, File, UploadFile
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from models import Complaint, User, Product, Order, Message, Notification
from auth import get_optional_user, check_role
from routes.conversations import upsert_complaint_conversation, upsert_finance_conversation, _save_attachment

router = APIRouter(prefix="/complaints", tags=["complaints"])
templates = Jinja2Templates(directory="templates")

COMPLAINT_CATEGORIES = {
    "payment": "Оплата",
    "delivery": "Доставка",
    "quality": "Качество товара",
    "order": "Заказ",
    "seller": "Продавец",
    "buyer": "Покупатель",
    "other": "Другое",
}


VALID_COMPLAINT_STATUSES = {
    "new",
    "processing",
    "in_progress",
    "resolved",
    "rejected",
    # Системный статус: жалоба передана бухгалтеру (см. /transfer)
    "sent_to_accountant",
}


def _admin_complaint_redirect(request: Request, complaint_id: int) -> str:
    referrer = request.headers.get("referer", "")
    if f"/complaints/admin/{complaint_id}" in referrer:
        return f"/complaints/admin/{complaint_id}"
    if "/complaints/admin" in referrer:
        return "/complaints/admin"
    return f"/complaints/admin/{complaint_id}"


@router.get("/create", response_class=HTMLResponse)
def complaint_create_page(
    request: Request,
    order_id: int = None,
    product_id: int = None,
    db: Session = Depends(get_db)
):
    """Страница создания жалобы"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    order = None
    product = None

    if order_id:
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user.id
        ).first()

    if product_id:
        product = db.query(Product).filter(Product.id == product_id).first()

    return templates.TemplateResponse("complaint_create", {
        "request": request,
        "user": user,
        "order": order,
        "product": product,
        "complaint_categories": COMPLAINT_CATEGORIES,
        "complaint_success": request.session.pop("complaint_success", None),
        "complaint_error": request.session.pop("complaint_error", None),
    })


@router.post("/create")
def create_complaint(
    request: Request,
    category: str = Form("other"),
    type: str = Form(""),
    text: str = Form(...),
    target_user_id: int = Form(None),
    target_product_id: int = Form(None),
    order_id: int = Form(None),
    attachment: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    """Создать жалобу (на фермера/товар/доставку)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    category = (category or type or "").strip() or "other"
    text = (text or "").strip()
    if category not in COMPLAINT_CATEGORIES or len(text) < 10:
        request.session["complaint_error"] = "Заполните тип и текст жалобы"
        return RedirectResponse("/complaints/create", status_code=303)
    if target_user_id and not db.query(User).filter(User.id == target_user_id).first():
        return RedirectResponse("/complaints/create", status_code=303)
    if target_product_id and not db.query(Product).filter(Product.id == target_product_id).first():
        return RedirectResponse("/complaints/create", status_code=303)
    if order_id and not db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first():
        return RedirectResponse("/complaints/create", status_code=303)

    attachment_path = _save_attachment(attachment)
    complaint = Complaint(
        user_id=user.id,
        order_id=order_id,
        target_user_id=target_user_id,
        target_product_id=target_product_id,
        type=category,
        category=category,
        text=text,
        attachment_path=attachment_path,
        status="new",
        assigned_to_role="accountant" if category == "payment" else "admin",
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    upsert_complaint_conversation(db, complaint)

    request.session["complaint_success"] = "Жалоба отправлена на рассмотрение"
    return RedirectResponse("/complaints/my", status_code=303)


@router.get("/my", response_class=HTMLResponse)
def my_complaints(request: Request, db: Session = Depends(get_db)):
    """Мои жалобы"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    complaints = db.query(Complaint).filter(
        Complaint.user_id == user.id
    ).order_by(Complaint.created_at.desc()).limit(50).all()

    # Подгружаем связанные данные
    complaint_list = []
    for c in complaints:
        complaint_data = {
            "complaint": c,
            "target_user": None,
            "target_product": None
        }
        if c.target_user_id:
            complaint_data["target_user"] = db.query(User).filter(User.id == c.target_user_id).first()
        if c.target_product_id:
            complaint_data["target_product"] = db.query(Product).filter(Product.id == c.target_product_id).first()
        complaint_list.append(complaint_data)

    return templates.TemplateResponse("complaints_my", {
        "request": request,
        "user": user,
        "complaints": complaint_list,
        "complaint_success": request.session.pop("complaint_success", None),
        "complaint_error": request.session.pop("complaint_error", None),
    })


@router.get("/admin", response_class=HTMLResponse)
def complaints_admin(request: Request, db: Session = Depends(get_db)):
    """Модерация жалоб — только manager и admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).limit(100).all()

    # Подгружаем связанные данные
    complaint_list = []
    for c in complaints:
        complaint_data = {
            "complaint": c,
            "author": None,
            "target_user": None,
            "target_product": None
        }
        if c.user_id:
            complaint_data["author"] = db.query(User).filter(User.id == c.user_id).first()
        if c.target_user_id:
            complaint_data["target_user"] = db.query(User).filter(User.id == c.target_user_id).first()
        if c.target_product_id:
            complaint_data["target_product"] = db.query(Product).filter(Product.id == c.target_product_id).first()
        complaint_list.append(complaint_data)

    return templates.TemplateResponse("complaints_admin", {
        "request": request,
        "user": user,
        "complaints": complaint_list,
        "complaint_success": request.session.pop("complaint_success", None),
        "complaint_error": request.session.pop("complaint_error", None),
    })


@router.get("/my/{complaint_id}", response_class=HTMLResponse)
def complaint_my_detail(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id, Complaint.user_id == user.id).first()
    if not complaint:
        return RedirectResponse("/complaints/my", status_code=303)
    order = db.query(Order).filter(Order.id == complaint.order_id).first() if complaint.order_id else None
    conversation = upsert_complaint_conversation(db, complaint)
    messages = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at.asc(), Message.id.asc()).all()
    return templates.TemplateResponse("complaint_detail", {
        "request": request,
        "user": user,
        "complaint": complaint,
        "order": order,
        "author": db.query(User).filter(User.id == complaint.user_id).first() if complaint.user_id else None,
        "target_user": db.query(User).filter(User.id == complaint.target_user_id).first() if complaint.target_user_id else None,
        "target_product": db.query(Product).filter(Product.id == complaint.target_product_id).first() if complaint.target_product_id else None,
        "conversation": conversation,
        "messages": messages,
        "can_reply": conversation.buyer_id == user.id,
        "can_status": False,
        "can_transfer": False,
    })


@router.get("/admin/{complaint_id}", response_class=HTMLResponse)
def complaint_admin_detail(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        return RedirectResponse("/complaints/admin", status_code=303)
    order = db.query(Order).filter(Order.id == complaint.order_id).first() if complaint.order_id else None
    conversation = upsert_complaint_conversation(db, complaint)
    messages = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at.asc(), Message.id.asc()).all()
    return templates.TemplateResponse("complaint_detail", {
        "request": request,
        "user": user,
        "complaint": complaint,
        "order": order,
        "author": db.query(User).filter(User.id == complaint.user_id).first() if complaint.user_id else None,
        "target_user": db.query(User).filter(User.id == complaint.target_user_id).first() if complaint.target_user_id else None,
        "target_product": db.query(Product).filter(Product.id == complaint.target_product_id).first() if complaint.target_product_id else None,
        "conversation": conversation,
        "messages": messages,
        "can_reply": True,
        "can_status": True,
        "can_transfer": complaint.category == "payment",
    })


@router.post("/admin/{complaint_id}/status")
@router.post("/status/{complaint_id}")
def update_status(
    complaint_id: int,
    request: Request,
    status: str = Form(...),
    response_text: str = Form(""),
    db: Session = Depends(get_db)
):
    """Изменить статус жалобы"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        request.session["complaint_error"] = "Жалоба не найдена."
        return RedirectResponse("/complaints/admin", status_code=303)

    if status not in VALID_COMPLAINT_STATUSES:
        request.session["complaint_error"] = "Недопустимый статус жалобы."
        return RedirectResponse(_admin_complaint_redirect(request, complaint_id), status_code=303)

    response_text = (response_text or "").strip()

    complaint.status = status
    if status == "sent_to_accountant":
        complaint.assigned_to_role = "accountant"

    conversation = upsert_complaint_conversation(db, complaint)
    if response_text:
        complaint.admin_response = response_text[:2000]
        db.add(Notification(
            user_id=complaint.user_id,
            type="system",
            subject=f"Ответ на жалобу #{complaint.id}",
            body=f"Поддержка оставила ответ по обращению #{complaint.id}: {response_text[:500]}"
        ))
        db.add(Message(
            conversation_id=conversation.id,
            sender_id=user.id,
            sender_role=user.role,
            text=response_text[:2000],
            is_read=0,
        ))

    db.commit()
    request.session["complaint_success"] = "Жалоба обновлена."
    return RedirectResponse(_admin_complaint_redirect(request, complaint.id), status_code=303)


@router.post("/{complaint_id}/delete")
def delete_complaint(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    """Удалить свою жалобу (только если new)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(
        Complaint.id == complaint_id,
        Complaint.user_id == user.id,
        Complaint.status == "new"
    ).first()
    if complaint:
        db.delete(complaint)
        db.commit()

    return RedirectResponse("/complaints/my", status_code=303)


@router.post("/admin/{complaint_id}/transfer")
def transfer_complaint_to_accountant(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin", "manager"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint and complaint.category == "payment":
        complaint.status = "sent_to_accountant"
        complaint.assigned_to_role = "accountant"
        db.commit()
        upsert_finance_conversation(db, complaint)
        request.session["complaint_success"] = "Обращение передано бухгалтеру"
    return RedirectResponse("/complaints/admin", status_code=303)
