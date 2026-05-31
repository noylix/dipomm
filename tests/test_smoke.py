"""Smoke tests covering the happy paths a buyer/seller/admin must hit."""

import json


def _register_data(email: str, password: str = "secret-pass", **extra):
    payload = {
        "email": email,
        "password": password,
        "full_name": "Тестовый Покупатель",
        "phone": "+79991234567",
    }
    payload.update(extra)
    return payload


def _contains(haystack: str, needle: str) -> bool:
    """React serialises props with ensure_ascii=True, so Russian shows up as \\uXXXX in HTML."""
    if needle in haystack:
        return True
    escaped = json.dumps(needle, ensure_ascii=True)[1:-1]  # strip surrounding quotes
    return escaped in haystack


def test_index_and_public_pages(client):
    for path in ("/", "/login", "/register", "/catalog", "/about", "/search?q=яблоки"):
        response = client.get(path)
        assert response.status_code == 200, f"{path} returned {response.status_code}"


def test_register_validates_inputs(client):
    bad_email = client.post("/register", data=_register_data("not-an-email", "abcdef"))
    assert bad_email.status_code == 200
    assert _contains(bad_email.text, "корректный email")

    short_password = client.post("/register", data=_register_data("fresh@example.com", "12"))
    assert short_password.status_code == 200
    assert _contains(short_password.text, "6 символов")


def test_register_normalizes_email_to_lowercase(client):
    response = client.post(
        "/register",
        data=_register_data("MixedCase@Example.COM"),
    )
    assert response.status_code == 303
    assert response.headers["location"] == "/verify-email/sent"

    # Re-using the same email in different case must be rejected.
    duplicate = client.post(
        "/register",
        data=_register_data("mixedcase@example.com", "another-pass"),
    )
    assert duplicate.status_code == 200
    assert _contains(duplicate.text, "уже существует")


def test_role_login_routes(client):
    for email, password, expected in [
        ("admin@farm.local", "admin123", "/admin/"),
        ("seller@farm.local", "seller123", "/seller/"),
        ("user@farm.local", "user123", "/"),
        ("brovin@farm.local", "brovin123", "/accounting/"),
    ]:
        client.cookies.clear()
        response = client.post("/login", data={"email": email, "password": password})
        assert response.status_code == 303, f"{email} login -> {response.status_code}"
        assert response.headers["location"] == expected


def test_register_sends_verification_email_and_allows_checkout_after_confirm(client, monkeypatch):
    sent = []

    def fake_send_email(to_email, subject, body):
        sent.append({"to": to_email, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("routes.users.send_email", fake_send_email)

    client.cookies.clear()
    new_email = "verify-flow@example.com"
    register = client.post("/register", data=_register_data(new_email))
    assert register.status_code == 303
    assert register.headers["location"] == "/verify-email/sent"
    assert sent, "verification email must be sent on registration"
    assert "/verify-email?token=" in sent[0]["body"]

    token = sent[0]["body"].split("token=")[-1].strip()
    confirm = client.get(f"/verify-email?token={token}")
    assert confirm.status_code == 200
    assert _contains(confirm.text, "успешно")

    submit = client.post("/order/create", data={
        "full_name": "Test Buyer",
        "phone": "+79991234567",
        "address": "Test address",
        "delivery_method": "courier",
        "delivery_date": "2026-06-01",
        "delivery_slot_choice": "14-18",
        "payment_method": "yookassa",
    })
    assert submit.status_code == 303
    assert submit.headers["location"] != "/cart/"


def test_verify_email_resend_endpoint(client, monkeypatch):
    sent = []

    def fake_send_email(to_email, subject, body):
        sent.append(to_email)
        return True

    monkeypatch.setattr("routes.users.send_email", fake_send_email)

    client.cookies.clear()
    client.post("/register", data=_register_data("resend-flow@example.com"))
    sent.clear()

    resend = client.post("/verify-email/resend")
    assert resend.status_code == 303
    assert sent == ["resend-flow@example.com"]


def test_buyer_cart_and_checkout_blocked_until_email_verified(client):
    """Unverified email must block /order/create; the demo user is pre-verified, so split into two scenes."""
    # Unverified path: fresh registration.
    client.cookies.clear()
    new_email = "checkout-flow@example.com"
    register = client.post("/register", data=_register_data(new_email))
    assert register.status_code == 303
    # We're now logged in but not verified.
    add = client.post("/cart/add/1")
    assert add.status_code in (303, 200)
    submit = client.post("/order/create", data={
        "full_name": "Test Buyer",
        "phone": "+79991234567",
        "address": "Test address",
        "delivery_method": "courier",
        "delivery_date": "2026-06-01",
        "delivery_slot_choice": "14-18",
        "payment_method": "yookassa",
    })
    assert submit.status_code == 303
    assert submit.headers["location"] == "/cart/"
    cart_page = client.get("/cart/")
    assert _contains(cart_page.text, "Подтвердите email")


def test_seller_admin_accountant_get_dashboards(client):
    for email, password, dashboard in [
        ("seller@farm.local", "seller123", "/seller/"),
        ("admin@farm.local", "admin123", "/admin/"),
        ("brovin@farm.local", "brovin123", "/accounting/"),
    ]:
        client.cookies.clear()
        client.post("/login", data={"email": email, "password": password})
        response = client.get(dashboard)
        assert response.status_code == 200, f"{email} {dashboard} -> {response.status_code}"


def test_admin_complaint_response_persists_and_notifies_client(client):
    from database import SessionLocal
    from models import Complaint, Conversation, Message, Notification

    client.post("/login", data={"email": "user@farm.local", "password": "user123"})
    create = client.post(
        "/complaints/create",
        data={"category": "other", "text": "Нужна помощь администратора по обращению"},
    )
    assert create.status_code == 303

    db = SessionLocal()
    try:
        complaint = db.query(Complaint).order_by(Complaint.id.desc()).first()
        assert complaint is not None
        complaint_id = complaint.id
    finally:
        db.close()

    client.cookies.clear()
    client.post("/login", data={"email": "admin@farm.local", "password": "admin123"})
    answer = "Admin response delivered to the client."
    update = client.post(
        f"/complaints/admin/{complaint_id}/status",
        data={"status": "processing", "response_text": answer},
        headers={"referer": f"http://testserver/complaints/admin/{complaint_id}"},
    )
    assert update.status_code == 303
    assert update.headers["location"] == f"/complaints/admin/{complaint_id}"

    db = SessionLocal()
    try:
        saved = db.query(Complaint).filter(Complaint.id == complaint_id).one()
        assert saved.status == "processing"
        assert saved.admin_response == answer
        assert db.query(Notification).filter(
            Notification.user_id == saved.user_id,
            Notification.subject == f"Ответ на жалобу #{complaint_id}",
        ).count() == 1
        conversation = db.query(Conversation).filter(
            Conversation.type == "complaint",
            Conversation.complaint_id == complaint_id,
        ).one()
        assert db.query(Message).filter(
            Message.conversation_id == conversation.id,
            Message.text == answer,
        ).count() == 1
    finally:
        db.close()


def test_seller_can_change_product_question_status_after_resolved(client):
    from database import SessionLocal
    from models import Conversation, Product, User

    db = SessionLocal()
    try:
        seller = db.query(User).filter(User.email == "seller@farm.local").first()
        buyer = db.query(User).filter(User.email == "user@farm.local").first()
        product = db.query(Product).filter(Product.owner_id == seller.id).first()
        assert seller and buyer and product
        conversation = Conversation(
            type="product_question",
            buyer_id=buyer.id,
            farmer_id=seller.id,
            product_id=product.id,
            status="resolved",
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        conversation_id = conversation.id
    finally:
        db.close()

    client.cookies.clear()
    client.post("/login", data={"email": "seller@farm.local", "password": "seller123"})
    reopen = client.post(
        f"/conversations/{conversation_id}/status",
        data={"status": "open"},
    )
    assert reopen.status_code == 303
    assert reopen.headers["location"] == f"/conversations/{conversation_id}"

    db = SessionLocal()
    try:
        saved = db.query(Conversation).filter(Conversation.id == conversation_id).one()
        assert saved.status == "open"
    finally:
        db.close()

    resolve_again = client.post(
        f"/conversations/{conversation_id}/status",
        data={"status": "resolved"},
    )
    assert resolve_again.status_code == 303

    db = SessionLocal()
    try:
        saved = db.query(Conversation).filter(Conversation.id == conversation_id).one()
        assert saved.status == "resolved"
    finally:
        db.close()
