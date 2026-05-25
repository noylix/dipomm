# routes/complaints.py
# Р–Р°Р»РѕР±С‹ Рё СЃРїРѕСЂС‹ (РњРѕРґСѓР»СЊ РєРѕРјРјСѓРЅРёРєР°С†РёРё Рё СѓРїСЂР°РІР»РµРЅРёСЏ СЃРѕРѕР±С‰РµСЃС‚РІРѕРј вЂ” Р–СѓРєРѕРІ РњР°РєСЃРёРј)

from fastapi import APIRouter, Depends, Request, Form, File, UploadFile
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from models import Complaint, User, Product, Order, Conversation, Message, Notification
from auth import get_optional_user, check_logged_in, check_role
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



@router.get("/create", response_class=HTMLResponse)
def complaint_create_page(
    request: Request,
    order_id: int = None,
    product_id: int = None,
    db: Session = Depends(get_db)
):
    """РЎС‚СЂР°РЅРёС†Р° СЃРѕР·РґР°РЅРёСЏ Р¶Р°Р»РѕР±С‹"""
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
    """РЎРѕР·РґР°С‚СЊ Р¶Р°Р»РѕР±Сѓ (РЅР° С„РµСЂРјРµСЂР°/С‚РѕРІР°СЂ/РґРѕСЃС‚Р°РІРєСѓ)"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    category = (category or type or "").strip() or "other"
    text = (text or "").strip()
    if category not in COMPLAINT_CATEGORIES or len(text) < 10:
        request.session["complaint_error"] = "Р—Р°РїРѕР»РЅРёС‚Рµ С‚РёРї Рё С‚РµРєСЃС‚ Р¶Р°Р»РѕР±С‹"
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

    request.session["complaint_success"] = "Р–Р°Р»РѕР±Р° РѕС‚РїСЂР°РІР»РµРЅР° РЅР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРµ"
    return RedirectResponse("/complaints/my", status_code=303)


@router.get("/my", response_class=HTMLResponse)
def my_complaints(request: Request, db: Session = Depends(get_db)):
    """РњРѕРё Р¶Р°Р»РѕР±С‹"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard

    complaints = db.query(Complaint).filter(
        Complaint.user_id == user.id
    ).order_by(Complaint.created_at.desc()).limit(50).all()

    # РџРѕРґРіСЂСѓР¶Р°РµРј СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ
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
    """РњРѕРґРµСЂР°С†РёСЏ Р¶Р°Р»РѕР± вЂ” С‚РѕР»СЊРєРѕ manager Рё admin"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    complaints = db.query(Complaint).order_by(Complaint.created_at.desc()).limit(100).all()

    # РџРѕРґРіСЂСѓР¶Р°РµРј СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ
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
        "conversation": conversation,
        "messages": messages,
        "can_reply": conversation.buyer_id == user.id,
        "can_status": False,
        "can_transfer": False,
    })


@router.get("/admin/{complaint_id}", response_class=HTMLResponse)
def complaint_admin_detail(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
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
        "conversation": conversation,
        "messages": messages,
        "can_reply": True,
        "can_status": True,
        "can_transfer": complaint.category == "payment",
    })


@router.post("/status/{complaint_id}")
def update_status(
    complaint_id: int,
    request: Request,
    status: str = Form(...),
    response_text: str = Form(""),
    db: Session = Depends(get_db)
):
    """РР·РјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ Р¶Р°Р»РѕР±С‹"""
    user = get_optional_user(request, db)
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint and status in ("new", "processing", "resolved", "rejected", "in_progress", "waiting_farmer", "sent_to_accountant", "closed"):
        previous_response = (complaint.admin_response or "").strip()
        complaint.status = status
        response_text = (response_text or "").strip()
        if response_text:
            complaint.admin_response = response_text[:2000]
            if response_text != previous_response:
                db.add(Notification(
                    user_id=complaint.user_id,
                    type="system",
                    subject=f"Ответ на жалобу #{complaint.id}",
                    body=f"Поддержка оставила ответ по обращению #{complaint.id}: {response_text[:500]}"
                ))
        complaint.assigned_to_role = "accountant" if status == "sent_to_accountant" else complaint.assigned_to_role
        upsert_complaint_conversation(db, complaint)
        db.commit()

    return RedirectResponse("/complaints/admin", status_code=303)


@router.post("/{complaint_id}/delete")
def delete_complaint(complaint_id: int, request: Request, db: Session = Depends(get_db)):
    """РЈРґР°Р»РёС‚СЊ СЃРІРѕСЋ Р¶Р°Р»РѕР±Сѓ (С‚РѕР»СЊРєРѕ РµСЃР»Рё new)"""
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
    guard = check_role(user, ["admin"])
    if guard:
        return guard

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint and complaint.category == "payment":
        complaint.status = "sent_to_accountant"
        complaint.assigned_to_role = "accountant"
        db.commit()
        upsert_finance_conversation(db, complaint)
        request.session["complaint_success"] = "РћР±СЂР°С‰РµРЅРёРµ РїРµСЂРµРґР°РЅРѕ Р±СѓС…РіР°Р»С‚РµСЂСѓ"
    return RedirectResponse("/complaints/admin", status_code=303)
