import os
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth import get_optional_user, check_role, hash_password, verify_password
from config import APP_BASE_URL, IS_PRODUCTION
from database import get_db
from email_utils import send_email, smtp_is_configured
from models import Notification, User


router = APIRouter(tags=["auth"])

PASSPORT_UPLOAD_DIR = os.path.join("static", "uploads", "passports")
os.makedirs(PASSPORT_UPLOAD_DIR, exist_ok=True)
ALLOWED_PASSPORT_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PASSPORT_SIZE = 5 * 1024 * 1024
SUPPLIER_DOC_UPLOAD_DIR = os.path.join("static", "uploads", "supplier_docs")
os.makedirs(SUPPLIER_DOC_UPLOAD_DIR, exist_ok=True)
ALLOWED_SUPPLIER_DOC_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def _save_passport_photo(upload: UploadFile | None) -> tuple[str | None, str | None]:
    if not upload or not upload.filename:
        return None, "Загрузите фото паспорта."

    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_PASSPORT_EXT:
        return None, "Разрешены только JPG, PNG и WEBP."

    content = upload.file.read()
    if not content:
        return None, "Не удалось прочитать файл паспорта."
    if len(content) > MAX_PASSPORT_SIZE:
        return None, "Размер файла не должен превышать 5 МБ."

    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(PASSPORT_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(content)
    return f"/static/uploads/passports/{filename}", None


def _save_supplier_document(upload: UploadFile | None) -> tuple[str | None, str | None]:
    if not upload or not upload.filename:
        return None, "Загрузите документ регистрации поставщика."

    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in ALLOWED_SUPPLIER_DOC_EXT:
        return None, "Разрешены JPG, PNG, WEBP или PDF."

    content = upload.file.read()
    if not content:
        return None, "Не удалось прочитать документ поставщика."
    if len(content) > MAX_PASSPORT_SIZE:
        return None, "Размер файла не должен превышать 5 МБ."

    filename = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(SUPPLIER_DOC_UPLOAD_DIR, filename)
    with open(full_path, "wb") as file_obj:
        file_obj.write(content)
    return f"/static/uploads/supplier_docs/{filename}", None


def _create_verification_notification(db: Session, user_id: int, verification_link: str) -> None:
    db.add(Notification(
        user_id=user_id,
        type="email",
        subject="Подтвердите ваш email",
        body=f"Здравствуйте! Для завершения регистрации перейдите по ссылке: {verification_link}",
    ))
    db.commit()


def _absolute_url(request: Request, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base_url = APP_BASE_URL or str(request.base_url).rstrip("/")
    return f"{base_url}{path}"


def _create_password_reset_notification(db: Session, user_id: int, reset_link: str) -> None:
    db.add(Notification(
        user_id=user_id,
        type="email",
        subject="\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f",
        body=(
            "\u0414\u043b\u044f \u0441\u0431\u0440\u043e\u0441\u0430 \u043f\u0430\u0440\u043e\u043b\u044f "
            f"\u043f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435: {reset_link}"
        ),
    ))


def _send_password_reset_email(to_email: str, reset_link: str) -> bool:
    subject = "\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f \u043d\u0430 \u0421\u0432\u043e\u0438 \u0420\u044f\u0434\u044b"
    body = (
        "\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!\n\n"
        "\u041c\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u0438 \u0437\u0430\u043f\u0440\u043e\u0441 "
        "\u043d\u0430 \u0441\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f. "
        "\u0427\u0442\u043e\u0431\u044b \u0437\u0430\u0434\u0430\u0442\u044c "
        "\u043d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c, "
        "\u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443:\n"
        f"{reset_link}\n\n"
        "\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 1 \u0447\u0430\u0441. "
        "\u0415\u0441\u043b\u0438 \u0432\u044b \u043d\u0435 \u0437\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u043b\u0438 "
        "\u0441\u0431\u0440\u043e\u0441, \u043f\u0440\u043e\u0441\u0442\u043e "
        "\u043f\u0440\u043e\u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u044d\u0442\u043e \u043f\u0438\u0441\u044c\u043c\u043e."
    )
    try:
        return send_email(to_email, subject, body)
    except Exception:
        return False


def _seller_response_context(**kwargs):
    context = {
        "user": None,
        "email": "",
        "full_name": "",
        "farm_name": "",
        "phone": "",
        "inn": "",
        "supplier_registration_data": "",
        "supplier_bank_details": "",
        "farm_address": "",
        "farm_description": "",
        "error": None,
    }
    context.update(kwargs)
    return context


@router.get("/login")
def login_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/" if user.role == "admin" else "/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request,
        "login",
        {"error": None, "user": None, "password_reset_success": request.session.pop("password_reset_success", False)},
    )


@router.post("/login")
def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        return request.app.state.templates.TemplateResponse(
            request,
            "login",
            {"error": "Неверный email или пароль", "user": None, "email": email},
        )

    if user.role == "seller" and user.seller_application_status != "approved":
        request.session["user_id"] = user.id
        return RedirectResponse("/seller/pending", status_code=303)

    request.session["user_id"] = user.id

    if user.role == "admin":
        return RedirectResponse("/admin/", status_code=303)
    if user.role == "accountant":
        return RedirectResponse("/accounting/", status_code=303)
    if user.role == "seller":
        return RedirectResponse("/seller/", status_code=303)
    return RedirectResponse("/", status_code=303)


@router.get("/forgot-password")
def forgot_password_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/" if user.role == "admin" else "/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request, "forgot_password", {"error": None, "user": None}
    )


@router.post("/forgot-password")
def forgot_password_submit(
    request: Request,
    email: str = Form(...),
    db: Session = Depends(get_db),
):
    email = (email or "").strip().lower()
    reset_link = ""
    mail_sent = False
    user = db.query(User).filter(User.email == email).first()
    if user:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
        reset_link = _absolute_url(request, f"/reset-password?token={reset_token}")
        _create_password_reset_notification(db, user.id, reset_link)
        mail_sent = _send_password_reset_email(user.email, reset_link)
        db.commit()

    request.session["password_reset_email"] = email
    request.session["password_reset_mail_sent"] = mail_sent
    if reset_link and (not IS_PRODUCTION or not smtp_is_configured()):
        request.session["password_reset_demo_link"] = reset_link
    else:
        request.session.pop("password_reset_demo_link", None)
    return RedirectResponse("/forgot-password/sent", status_code=303)


@router.get("/forgot-password/sent")
def forgot_password_sent(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    return request.app.state.templates.TemplateResponse(
        request,
        "forgot_password_sent",
        {
            "user": user,
            "email": request.session.pop("password_reset_email", ""),
            "mail_sent": request.session.pop("password_reset_mail_sent", False),
            "reset_link": request.session.pop("password_reset_demo_link", ""),
        },
    )


@router.get("/reset-password")
def reset_password_page(request: Request, token: str = "", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == token).first() if token else None
    token_valid = bool(user and user.password_reset_expires_at and user.password_reset_expires_at >= datetime.utcnow())
    return request.app.state.templates.TemplateResponse(
        request,
        "reset_password",
        {
            "user": None,
            "token": token if token_valid else "",
            "error": None if token_valid else "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 \u0438\u043b\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430.",
        },
    )


@router.post("/reset-password")
def reset_password_submit(
    request: Request,
    token: str = Form(...),
    password: str = Form(...),
    password_confirm: str = Form(...),
    db: Session = Depends(get_db),
):
    token = (token or "").strip()
    user = db.query(User).filter(User.password_reset_token == token).first() if token else None
    token_valid = bool(user and user.password_reset_expires_at and user.password_reset_expires_at >= datetime.utcnow())
    if not token_valid:
        return request.app.state.templates.TemplateResponse(
            request,
            "reset_password",
            {
                "user": None,
                "token": "",
                "error": "\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 \u0438\u043b\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430.",
            },
        )
    if len(password or "") < 6:
        return request.app.state.templates.TemplateResponse(
            request,
            "reset_password",
            {
                "user": None,
                "token": token,
                "error": "\u041f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043d\u0435 \u043a\u043e\u0440\u043e\u0447\u0435 6 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.",
            },
        )
    if password != password_confirm:
        return request.app.state.templates.TemplateResponse(
            request,
            "reset_password",
            {
                "user": None,
                "token": token,
                "error": "\u041f\u0430\u0440\u043e\u043b\u0438 \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0442.",
            },
        )

    user.password_hash = hash_password(password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()
    request.session.clear()
    request.session["password_reset_success"] = True
    return RedirectResponse("/login", status_code=303)


@router.get("/register")
def register_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/" if user.role == "admin" else "/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request, "register", {"error": None, "user": None}
    )


@router.get("/become-seller")
def become_seller_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/" if user.role == "admin" else "/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request, "become_seller", _seller_response_context()
    )


@router.post("/register")
def register_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    email = (email or "").strip()

    if db.query(User).filter(User.email == email).first():
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            {"error": "Пользователь с таким email уже существует", "user": None, "email": email},
        )

    verification_token = secrets.token_urlsafe(32)
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        role="user",
        is_approved=1,
        email_verified=0,
        verification_token=verification_token,
        seller_application_status="approved",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    verification_link = f"/verify-email?token={verification_token}"
    _create_verification_notification(db, new_user.id, verification_link)

    request.session["user_id"] = new_user.id
    request.session["pending_verification"] = verification_link
    return RedirectResponse("/verify-email/sent", status_code=303)


@router.post("/become-seller")
def become_seller_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(""),
    farm_name: str = Form(""),
    phone: str = Form(""),
    inn: str = Form(""),
    supplier_registration_data: str = Form(""),
    supplier_bank_details: str = Form(""),
    farm_address: str = Form(""),
    farm_description: str = Form(""),
    passport_photo: UploadFile = File(None),
    supplier_document: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    email = (email or "").strip()
    full_name = (full_name or "").strip()
    farm_name = (farm_name or "").strip()
    phone = (phone or "").strip()
    inn = (inn or "").strip()
    supplier_registration_data = (supplier_registration_data or "").strip()
    supplier_bank_details = (supplier_bank_details or "").strip()
    farm_address = (farm_address or "").strip()
    farm_description = (farm_description or "").strip()

    response_context = _seller_response_context(
        email=email,
        full_name=full_name,
        farm_name=farm_name,
        phone=phone,
        inn=inn,
        supplier_registration_data=supplier_registration_data,
        supplier_bank_details=supplier_bank_details,
        farm_address=farm_address,
        farm_description=farm_description,
    )

    if db.query(User).filter(User.email == email).first():
        response_context["error"] = "Пользователь с таким email уже существует"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if not all([full_name, farm_name, phone, inn, farm_address, supplier_registration_data]):
        response_context["error"] = "Заполните обязательные поля: имя, название фермы, телефон, ИНН и адрес"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if not (inn.isdigit() and len(inn) in (10, 12)):
        response_context["error"] = "ИНН должен содержать 10 или 12 цифр"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    passport_photo_url, passport_error = _save_passport_photo(passport_photo)
    if passport_error:
        response_context["error"] = passport_error
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    supplier_document_url, supplier_doc_error = _save_supplier_document(supplier_document)
    if supplier_doc_error:
        response_context["error"] = supplier_doc_error
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    verification_token = secrets.token_urlsafe(32)
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        role="seller",
        is_approved=0,
        email_verified=0,
        verification_token=verification_token,
        full_name=full_name,
        farm_name=farm_name,
        phone=phone,
        inn=inn,
        farm_address=farm_address,
        farm_description=farm_description or None,
        passport_photo_url=passport_photo_url,
        supplier_registration_data=supplier_registration_data,
        supplier_document_url=supplier_document_url,
        supplier_bank_details=supplier_bank_details or None,
        seller_application_status="pending",
        seller_application_rejection_reason=None,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    verification_link = f"/verify-email?token={verification_token}"
    _create_verification_notification(db, new_user.id, verification_link)

    request.session["user_id"] = new_user.id
    request.session["pending_verification"] = verification_link
    request.session["seller_pending_notice"] = (
        "Анкета отправлена на модерацию. После проверки администратором вы получите доступ к функциям фермера."
    )
    return RedirectResponse("/seller/pending", status_code=303)


@router.get("/verify-email/sent")
def verify_email_sent(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    verification_link = request.session.get("pending_verification", "")
    return request.app.state.templates.TemplateResponse(
        request, "verify_email_sent", {"user": user, "verification_link": verification_link}
    )


@router.get("/verify-email")
def verify_email_confirm(request: Request, token: str = "", db: Session = Depends(get_db)):
    if not token:
        return RedirectResponse("/", status_code=303)

    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        return request.app.state.templates.TemplateResponse(
            request,
            "verify_email_result",
            {"user": None, "success": False, "message": "Недействительная или устаревшая ссылка подтверждения."},
        )

    user.email_verified = 1
    user.verification_token = None
    db.commit()
    request.session.pop("pending_verification", None)
    return request.app.state.templates.TemplateResponse(
        request,
        "verify_email_result",
        {"user": user, "success": True, "message": "Email успешно подтвержден."},
    )


@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=303)


@router.get("/profile")
def profile_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard
    from models import Order, OrderItem, Product, Review, SellerReview
    from sqlalchemy.orm import joinedload
    from order_statuses import ORDER_STATUS_LABELS, ORDER_STATUS_BADGES

    orders = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product).joinedload(Product.owner),
            joinedload(Order.delivery),
        )
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )
    reviewed_pairs = {(r.product_id, r.order_id) for r in db.query(Review).filter(Review.user_id == user.id).all()}
    seller_reviews = db.query(SellerReview).filter(SellerReview.user_id == user.id).all()
    reviewed_seller_keys = [f"{r.order_id}:{r.seller_id}" for r in seller_reviews if r.order_id and r.seller_id]
    return request.app.state.templates.TemplateResponse(
        request,
        "profile",
        {
            "user": user,
            "orders": orders,
            "reviewed_pairs": reviewed_pairs,
            "reviewed_seller_keys": reviewed_seller_keys,
            "status_labels": ORDER_STATUS_LABELS,
            "status_badges": ORDER_STATUS_BADGES,
            "profile_success": request.session.pop("profile_success", None),
        },
    )


@router.post("/profile/update")
def profile_update(
    request: Request,
    full_name: str = Form(""),
    phone: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_optional_user(request, db)
    guard = check_role(user, ["user"])
    if guard:
        return guard
    user.full_name = (full_name or "").strip() or None
    user.phone = (phone or "").strip() or None
    db.commit()
    request.session["profile_success"] = "Профиль обновлен."
    return RedirectResponse("/profile", status_code=303)
