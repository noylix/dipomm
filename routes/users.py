import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth import get_optional_user, check_role, hash_password, is_email_verified, verify_password
from config import APP_BASE_URL, ENABLE_PASSWORD_RESET_DEMO_LINKS, IS_PRODUCTION
from database import get_db
from email_utils import send_email, smtp_is_configured
from models import Notification, User
from farmer_applications import ensure_seller_application_number
from phone_utils import format_ru_phone, is_valid_ru_phone


router = APIRouter(tags=["auth"])



def _create_verification_notification(db: Session, user_id: int, verification_link: str) -> None:
    db.add(Notification(
        user_id=user_id,
        type="email",
        subject="Подтвердите ваш email",
        body=f"Здравствуйте! Для завершения регистрации перейдите по ссылке: {verification_link}",
    ))


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


def _ensure_verification_token(user: User, db: Session) -> None:
    if not user.verification_token:
        user.verification_token = secrets.token_urlsafe(32)
        db.commit()


def _verification_link_for_user(request: Request, user: User, db: Session | None = None) -> str:
    if is_email_verified(user) or not user:
        return ""
    if db is not None:
        _ensure_verification_token(user, db)
    elif not user.verification_token:
        return ""
    return _absolute_url(request, f"/verify-email?token={user.verification_token}")


def _send_verification_email(to_email: str, verification_link: str) -> bool:
    subject = "Подтвердите email на Свои Ряды"
    body = (
        "Здравствуйте!\n\n"
        "Чтобы оформлять заказы на платформе, подтвердите ваш email по ссылке:\n"
        f"{verification_link}\n\n"
        "Если вы не регистрировались на Свои Ряды, просто проигнорируйте это письмо."
    )
    try:
        return send_email(to_email, subject, body)
    except Exception:
        return False


def _issue_email_verification(request: Request, user: User, db: Session) -> tuple[str, bool]:
    verification_link = _verification_link_for_user(request, user, db)
    _create_verification_notification(db, user.id, verification_link)
    mail_sent = _send_verification_email(user.email, verification_link)
    db.commit()
    return verification_link, mail_sent


def _store_verification_session(request: Request, verification_link: str, mail_sent: bool) -> None:
    request.session["pending_verification"] = verification_link
    request.session["verification_mail_sent"] = mail_sent
    if verification_link and (not mail_sent and (not IS_PRODUCTION or not smtp_is_configured())):
        request.session["verification_demo_link"] = verification_link
    else:
        request.session.pop("verification_demo_link", None)


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


def _register_response_context(**kwargs):
    context = {
        "user": None,
        "error": None,
        "email": "",
        "full_name": "",
        "phone": "",
    }
    context.update(kwargs)
    return context


def _seller_response_context(**kwargs):
    context = {
        "user": None,
        "email": "",
        "full_name": "",
        "farm_name": "",
        "phone": "",
        "farm_address": "",
        "farm_description": "",
        "product_categories": "",
        "error": None,
    }
    context.update(kwargs)
    return context


@router.get("/login")
def login_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/moderation" if user.role == "manager" else "/admin/" if user.role == "admin" else "/", status_code=303)
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
    if user.role == "manager":
        return RedirectResponse("/admin/moderation", status_code=303)
    if user.role == "accountant":
        return RedirectResponse("/accounting/", status_code=303)
    if user.role == "seller":
        return RedirectResponse("/seller/", status_code=303)
    return RedirectResponse("/", status_code=303)


@router.get("/forgot-password")
def forgot_password_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/moderation" if user.role == "manager" else "/admin/" if user.role == "admin" else "/", status_code=303)
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
    if reset_link and ENABLE_PASSWORD_RESET_DEMO_LINKS and not IS_PRODUCTION and not smtp_is_configured():
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
        return RedirectResponse("/seller/" if user.role == "seller" else "/accounting/" if user.role == "accountant" else "/admin/moderation" if user.role == "manager" else "/admin/" if user.role == "admin" else "/", status_code=303)
    return request.app.state.templates.TemplateResponse(
        request, "register", _register_response_context()
    )


@router.get("/become-seller")
def become_seller_page(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if user:
        if user.role == "seller":
            if (user.seller_application_status or "pending") != "approved":
                return RedirectResponse("/seller/pending", status_code=303)
            return RedirectResponse("/seller/", status_code=303)
        if user.role == "accountant":
            return RedirectResponse("/accounting/", status_code=303)
        if user.role == "manager":
            return RedirectResponse("/admin/moderation", status_code=303)
        if user.role == "admin":
            return RedirectResponse("/admin/", status_code=303)
        if user.role == "user":
            return request.app.state.templates.TemplateResponse(
                request,
                "become_seller",
                _seller_response_context(
                    email=user.email,
                    full_name=user.full_name or "",
                    phone=user.phone or "",
                ),
            )
    return request.app.state.templates.TemplateResponse(
        request, "become_seller", _seller_response_context()
    )


@router.post("/register")
def register_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(""),
    phone: str = Form(""),
    db: Session = Depends(get_db),
):
    email = (email or "").strip().lower()
    full_name = (full_name or "").strip()
    phone = (phone or "").strip()

    if len(full_name) < 2:
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            _register_response_context(
                error="Укажите ФИО (не короче 2 символов).",
                email=email,
                full_name=full_name,
                phone=phone,
            ),
        )

    if not is_valid_ru_phone(phone):
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            _register_response_context(
                error="Укажите корректный номер телефона в формате +7 (999) 999-99-99.",
                email=email,
                full_name=full_name,
                phone=phone,
            ),
        )

    if "@" not in email or "." not in email.split("@")[-1]:
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            _register_response_context(
                error="Введите корректный email",
                email=email,
                full_name=full_name,
                phone=phone,
            ),
        )

    if len(password or "") < 6:
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            _register_response_context(
                error="Пароль должен быть не короче 6 символов",
                email=email,
                full_name=full_name,
                phone=phone,
            ),
        )

    if db.query(User).filter(User.email == email).first():
        return request.app.state.templates.TemplateResponse(
            request,
            "register",
            _register_response_context(
                error="Пользователь с таким email уже существует",
                email=email,
                full_name=full_name,
                phone=phone,
            ),
        )

    verification_token = secrets.token_urlsafe(32)
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=format_ru_phone(phone),
        role="user",
        is_approved=1,
        email_verified=0,
        verification_token=verification_token,
        seller_application_status="approved",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    request.session["user_id"] = new_user.id
    verification_link, mail_sent = _issue_email_verification(request, new_user, db)
    _store_verification_session(request, verification_link, mail_sent)
    return RedirectResponse("/verify-email/sent", status_code=303)


@router.post("/become-seller")
def become_seller_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(""),
    farm_name: str = Form(""),
    phone: str = Form(""),
    farm_address: str = Form(""),
    product_categories: str = Form(""),
    farm_description: str = Form(""),
    db: Session = Depends(get_db),
):
    email = (email or "").strip().lower()
    full_name = (full_name or "").strip()
    farm_name = (farm_name or "").strip()
    phone = (phone or "").strip()
    farm_address = (farm_address or "").strip()
    product_categories = (product_categories or "").strip()
    farm_description = (farm_description or "").strip()

    response_context = _seller_response_context(
        email=email,
        full_name=full_name,
        farm_name=farm_name,
        phone=phone,
        farm_address=farm_address,
        product_categories=product_categories,
        farm_description=farm_description,
    )

    if "@" not in email or "." not in email.split("@")[-1]:
        response_context["error"] = "Введите корректный email"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if len(password or "") < 6:
        response_context["error"] = "Пароль должен быть не короче 6 символов"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if db.query(User).filter(User.email == email).first():
        response_context["error"] = "Пользователь с таким email уже существует"
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if not all([full_name, farm_name, phone, email, farm_address, product_categories, farm_description]):
        response_context["error"] = "Заполните обязательные поля заявки."
        return request.app.state.templates.TemplateResponse(request, "become_seller", response_context)

    if not is_valid_ru_phone(phone):
        response_context["error"] = "Укажите номер телефона полностью в формате +7 (999) 999-99-99."
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
        phone=format_ru_phone(phone),
        inn=None,
        farm_address=farm_address,
        farm_description=farm_description or None,
        product_categories=product_categories,
        seller_application_status="pending",
        seller_application_rejection_reason=None,
        seller_application_admin_comment=None,
    )
    db.add(new_user)
    db.flush()
    ensure_seller_application_number(new_user)
    db.commit()
    db.refresh(new_user)

    request.session["user_id"] = new_user.id
    verification_link, mail_sent = _issue_email_verification(request, new_user, db)
    _store_verification_session(request, verification_link, mail_sent)
    request.session["seller_pending_notice"] = (
        f"Заявка {new_user.seller_application_number} отправлена. "
        "Сотрудник платформы свяжется с вами для уточнения данных и подключения к платформе."
    )
    return RedirectResponse("/seller/pending", status_code=303)


@router.get("/verify-email/sent")
def verify_email_sent(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    verification_link = request.session.get("pending_verification", "")
    if user and not verification_link and not is_email_verified(user):
        verification_link = _verification_link_for_user(request, user, db)
    return request.app.state.templates.TemplateResponse(
        request,
        "verify_email_sent",
        {
            "user": user,
            "verification_link": verification_link,
            "verification_mail_sent": request.session.pop("verification_mail_sent", False),
            "verification_demo_link": request.session.pop("verification_demo_link", ""),
        },
    )


@router.post("/verify-email/resend")
def verify_email_resend(request: Request, db: Session = Depends(get_db)):
    user = get_optional_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=303)
    if is_email_verified(user):
        return RedirectResponse("/cart/", status_code=303)

    verification_link, mail_sent = _issue_email_verification(request, user, db)
    _store_verification_session(request, verification_link, mail_sent)

    if mail_sent:
        request.session["cart_success"] = "Письмо с подтверждением отправлено на ваш email."
    else:
        request.session["cart_error"] = (
            "Не удалось отправить письмо. Проверьте папку «Спам» или используйте ссылку подтверждения ниже."
        )

    referer = (request.headers.get("referer") or "").lower()
    if "/cart" in referer:
        return RedirectResponse("/cart/", status_code=303)
    return RedirectResponse("/verify-email/sent", status_code=303)


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
            "profile_error": request.session.pop("profile_error", None),
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
    if phone and not is_valid_ru_phone(phone):
        request.session["profile_error"] = "Укажите номер телефона полностью в формате +7 (999) 999-99-99."
        return RedirectResponse("/profile", status_code=303)
    user.phone = format_ru_phone(phone) if phone else None
    db.commit()
    request.session["profile_success"] = "Профиль обновлен."
    return RedirectResponse("/profile", status_code=303)
