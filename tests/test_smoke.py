"""Smoke and regression tests for buyer, seller, admin, and payment safety paths."""

from datetime import date, timedelta
from decimal import Decimal
import json
import re


def _register_data(email: str, password: str = "secret-pass", **extra):
    payload = {
        "email": email,
        "password": password,
        "full_name": "Test Buyer",
        "phone": "+79991234567",
    }
    payload.update(extra)
    return payload


def _contains(haystack: str, needle: str) -> bool:
    if needle in haystack:
        return True
    escaped = json.dumps(needle, ensure_ascii=True)[1:-1]
    return escaped in haystack


def _future_date() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


def test_index_and_public_pages(client):
    for path in ("/", "/login", "/register", "/catalog", "/about", "/search?q=apple"):
        response = client.get(path)
        assert response.status_code == 200, f"{path} returned {response.status_code}"


def test_healthz_reports_database_connection(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_demo_order_totals_use_effective_product_prices(client):
    from database import SessionLocal
    from marketplace_utils import effective_product_price
    from models import Order

    db = SessionLocal()
    try:
        demo_orders = db.query(Order).filter(Order.order_number.like("FM-DEMO-%")).all()
        assert demo_orders
        for order in demo_orders:
            goods_total = sum(
                effective_product_price(item.product) * int(item.quantity or 0)
                for item in order.items
                if item.product
            )
            expected = goods_total - Decimal(order.discount_amount or 0) + Decimal(order.delivery_fee or 0)
            assert Decimal(order.total_price or 0) == expected
    finally:
        db.close()


def test_register_validates_inputs(client):
    bad_email = client.post("/register", data=_register_data("not-an-email", "abcdef"))
    assert bad_email.status_code == 200

    short_password = client.post("/register", data=_register_data("fresh@example.com", "12"))
    assert short_password.status_code == 200


def test_register_normalizes_email_to_lowercase(client):
    response = client.post("/register", data=_register_data("MixedCase@Example.COM"))
    assert response.status_code == 303
    assert response.headers["location"] == "/verify-email/sent"

    duplicate = client.post("/register", data=_register_data("mixedcase@example.com", "another-pass"))
    assert duplicate.status_code == 200


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


def test_authenticated_catalog_api_available_to_staff_roles(client):
    for email, password in [
        ("seller@farm.local", "seller123"),
        ("admin@farm.local", "admin123"),
    ]:
        client.cookies.clear()
        client.post("/login", data={"email": email, "password": password})
        response = client.get("/api/products")
        assert response.status_code == 200, f"{email} /api/products -> {response.status_code}"


def test_register_sends_verification_email_and_allows_checkout_after_confirm(client, monkeypatch):
    sent = []

    def fake_send_email(to_email, subject, body):
        sent.append({"to": to_email, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("routes.users.send_email", fake_send_email)

    client.cookies.clear()
    register = client.post("/register", data=_register_data("verify-flow@example.com"))
    assert register.status_code == 303
    assert register.headers["location"] == "/verify-email/sent"
    assert sent

    token_match = re.search(r"/verify-email\?token=([A-Za-z0-9_-]+)", sent[0]["body"])
    assert token_match, "verification email must contain a clean token URL"
    confirm = client.get(f"/verify-email?token={token_match.group(1)}")
    assert confirm.status_code == 200

    for _ in range(31):
        add = client.post("/cart/add/1")
        assert add.status_code in (303, 200)

    submit = client.post("/order/create", data={
        "full_name": "Test Buyer",
        "phone": "+79991234567",
        "address": "Test address",
        "delivery_method": "courier",
        "delivery_date": _future_date(),
        "delivery_slot_choice": "14-18",
        "payment_method": "yookassa",
    })
    assert submit.status_code == 303
    assert submit.headers["location"] != "/cart/"


def test_password_reset_page_does_not_disclose_token(client):
    client.cookies.clear()
    submit = client.post("/forgot-password", data={"email": "admin@farm.local"})
    assert submit.status_code == 303
    assert submit.headers["location"] == "/forgot-password/sent"

    sent_page = client.get("/forgot-password/sent")
    assert sent_page.status_code == 200
    assert "/reset-password?token=" not in sent_page.text


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
    client.cookies.clear()
    register = client.post("/register", data=_register_data("checkout-flow@example.com"))
    assert register.status_code == 303

    add = client.post("/cart/add/1")
    assert add.status_code in (303, 200)
    submit = client.post("/order/create", data={
        "full_name": "Test Buyer",
        "phone": "+79991234567",
        "address": "Test address",
        "delivery_method": "courier",
        "delivery_date": _future_date(),
        "delivery_slot_choice": "14-18",
        "payment_method": "yookassa",
    })
    assert submit.status_code == 303
    assert submit.headers["location"] == "/cart/"


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


def test_buyer_can_submit_product_review_for_completed_order(client):
    from database import SessionLocal
    from models import Order, Review, User

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        order = (
            db.query(Order)
            .filter(Order.user_id == buyer.id, Order.status == "completed")
            .order_by(Order.id.desc())
            .first()
        )
        assert order and order.items
        product_id = order.items[0].product_id
        db.query(Review).filter(
            Review.user_id == order.user_id,
            Review.order_id == order.id,
            Review.product_id == product_id,
        ).delete()
        db.commit()
        order_id = order.id
    finally:
        db.close()

    client.cookies.clear()
    client.post("/login", data={"email": "user@farm.local", "password": "user123"})
    response = client.post("/reviews/create", data={
        "order_id": str(order_id),
        "product_id": str(product_id),
        "rating": "5",
        "text": "Свежий товар, заказом доволен.",
    })
    assert response.status_code == 303
    assert response.headers["location"] == "/order/orders"

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        review = db.query(Review).filter(
            Review.user_id == buyer.id,
            Review.order_id == order_id,
            Review.product_id == product_id,
        ).one()
        assert review.status == "pending"
        assert review.text == "Свежий товар, заказом доволен."
    finally:
        db.close()

    orders_page = client.get("/order/orders")
    assert orders_page.status_code == 200
    assert _contains(orders_page.text, "Отзыв о товаре отправлен на модерацию.")


def test_buyer_order_pages_render_with_delivery(client):
    client.cookies.clear()
    client.post("/login", data={"email": "user@farm.local", "password": "user123"})

    for path in ("/profile", "/order/orders"):
        response = client.get(path)
        assert response.status_code == 200, f"{path} -> {response.status_code}"


def test_delivery_service_exposes_seller_options(client):
    from database import SessionLocal
    from delivery_service import normalize_delivery_method, seller_delivery_options, seller_slots
    from marketplace_utils import MIN_ORDER_AMOUNT
    from models import User

    db = SessionLocal()
    try:
        seller = db.query(User).filter(User.email == "seller@farm.local").one()
        options = seller_delivery_options(seller, MIN_ORDER_AMOUNT)
        methods = {option["method"] for option in options}
        assert "pickup" in methods
        assert "farmer_delivery" in methods
        assert seller_slots(seller)
        assert normalize_delivery_method("courier") == "farmer_delivery"
        assert normalize_delivery_method("post") == "partner_delivery"
    finally:
        db.close()


def test_logistics_supports_current_delivery_methods(client):
    from database import SessionLocal
    from logistics import ensure_logistics_shipment
    from models import Delivery, Order, User
    from yandex_delivery import YANDEX_PROVIDER_NAME, create_test_yandex_shipment

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        order = Order(
            user_id=buyer.id,
            total_price=Decimal("100.00"),
            status="ready_for_delivery",
            payment_status="paid",
            delivery_method="farmer_delivery",
        )
        db.add(order)
        db.flush()
        delivery = Delivery(order_id=order.id, method="farmer_delivery", status="ready_for_delivery")
        db.add(delivery)
        db.flush()

        shipment = ensure_logistics_shipment(order)
        assert shipment is delivery
        assert shipment.provider == "FreshRoute Logistics"
        assert shipment.track_number
        assert shipment.tracking_url == f"/delivery/track/{shipment.track_number}"

        partner_order = Order(
            user_id=buyer.id,
            total_price=Decimal("100.00"),
            status="ready_for_delivery",
            payment_status="paid",
            delivery_method="partner_delivery",
        )
        db.add(partner_order)
        db.flush()
        partner_delivery = Delivery(
            order_id=partner_order.id,
            method="partner_delivery",
            status="ready_for_delivery",
            provider="Legacy Partner",
            track_number="FD-OLD-TRACK",
        )
        db.add(partner_delivery)
        db.flush()

        yandex_preview = create_test_yandex_shipment(partner_order)
        yandex_shipment = ensure_logistics_shipment(partner_order)
        assert yandex_shipment is partner_delivery
        assert yandex_shipment.provider == YANDEX_PROVIDER_NAME
        assert yandex_shipment.provider_name == YANDEX_PROVIDER_NAME
        assert yandex_shipment.external_id == yandex_preview.external_id
        assert yandex_shipment.track_number == yandex_preview.track_number
        assert yandex_shipment.track_number.startswith("YM")
        assert yandex_shipment.tracking_url == f"/delivery/track/{yandex_shipment.track_number}"
    finally:
        db.rollback()
        db.close()


def test_delivery_tracking_permissions_and_seller_status_flow(client):
    from auth import hash_password
    from database import SessionLocal
    from models import Delivery, Order, OrderItem, Product, User

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        seller = db.query(User).filter(User.email == "seller@farm.local").one()
        product = db.query(Product).filter(Product.owner_id == seller.id, Product.status == "approved").first()
        assert product is not None

        other = User(
            email="other-buyer@example.com",
            password_hash=hash_password("other123"),
            role="user",
            is_approved=1,
            email_verified=1,
            seller_application_status="approved",
        )
        db.add(other)
        db.flush()

        order = Order(
            user_id=buyer.id,
            total_price=Decimal("620.00"),
            status="paid",
            payment_status="paid",
            selected_payment_method="yookassa",
            delivery_method="partner_delivery",
            delivery_address="Test delivery address",
            delivery_slot=f"{_future_date()} 14:00-18:00",
            delivery_fee=Decimal("500.00"),
        )
        db.add(order)
        db.flush()
        db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=1))
        db.add(Delivery(
            order_id=order.id,
            address="Test delivery address",
            method="partner_delivery",
            provider="Demo logistics",
            provider_name="Demo logistics",
            track_number="TEST-TRACK-001",
            tracking_url="/delivery/track/TEST-TRACK-001",
            status="waiting_assembly",
            delivery_slot=f"{_future_date()} 14:00-18:00",
            delivery_fee=Decimal("500.00"),
        ))
        db.commit()
        order_id = order.id
    finally:
        db.close()

    for email, password, expected in [
        ("user@farm.local", "user123", 200),
        ("seller@farm.local", "seller123", 200),
        ("admin@farm.local", "admin123", 200),
        ("other-buyer@example.com", "other123", 303),
    ]:
        client.cookies.clear()
        client.post("/login", data={"email": email, "password": password})
        response = client.get("/delivery/track/TEST-TRACK-001")
        assert response.status_code == expected, f"{email} track -> {response.status_code}"

    client.cookies.clear()
    client.post("/login", data={"email": "seller@farm.local", "password": "seller123"})
    for action in ("assemble", "transfer_partner", "in_delivery", "delivered"):
        response = client.post(f"/seller/orders/{order_id}/status", data={"action": action})
        assert response.status_code == 303

    db = SessionLocal()
    try:
        saved = db.query(Order).filter(Order.id == order_id).one()
        assert saved.status == "delivered"
        assert saved.delivery.status == "delivered"
    finally:
        db.close()


def test_admin_orders_show_number_customer_delivery_and_client_history(client):
    from database import SessionLocal
    from models import Delivery, Order, OrderItem, Product, User

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        seller = db.query(User).filter(User.email == "seller@farm.local").one()
        product = db.query(Product).filter(Product.owner_id == seller.id, Product.status == "approved").first()
        assert product is not None

        first = Order(
            order_number="FM-ADMIN-001",
            user_id=buyer.id,
            total_price=Decimal("750.00"),
            status="paid",
            payment_status="paid",
            selected_payment_method="yookassa",
            customer_name="Admin Visible Buyer",
            customer_phone="+79990000001",
            delivery_method="partner_delivery",
            delivery_address="Admin delivery address",
            delivery_slot=f"{_future_date()} 12:00-16:00",
            delivery_fee=Decimal("500.00"),
        )
        second = Order(
            order_number="FM-ADMIN-002",
            user_id=buyer.id,
            total_price=Decimal("320.00"),
            status="delivered",
            payment_status="paid",
            selected_payment_method="yookassa",
            customer_name="Admin Visible Buyer",
            customer_phone="+79990000001",
            delivery_method="pickup",
            delivery_address="Farm pickup point",
            delivery_slot=f"{_future_date()} 16:00-18:00",
        )
        db.add_all([first, second])
        db.flush()
        db.add(OrderItem(order_id=first.id, product_id=product.id, quantity=1))
        db.add(OrderItem(order_id=second.id, product_id=product.id, quantity=1))
        db.add(Delivery(
            order_id=first.id,
            address="Admin delivery address",
            method="partner_delivery",
            provider="Demo logistics",
            provider_name="Demo logistics",
            track_number="ADMIN-TRACK-001",
            tracking_url="/delivery/track/ADMIN-TRACK-001",
            status="in_transit",
            delivery_slot=f"{_future_date()} 12:00-16:00",
            delivery_fee=Decimal("500.00"),
        ))
        db.commit()
    finally:
        db.close()

    client.cookies.clear()
    client.post("/login", data={"email": "admin@farm.local", "password": "admin123"})
    response = client.get("/admin/manage?tab=orders")

    assert response.status_code == 200
    for expected in (
        "FM-ADMIN-001",
        "FM-ADMIN-002",
        "Admin Visible Buyer",
        "user@farm.local",
        "Admin delivery address",
        "ADMIN-TRACK-001",
    ):
        assert _contains(response.text, expected)


def test_accounting_requests_tab_redirects_to_dashboard(client):
    client.cookies.clear()
    client.post("/login", data={"email": "brovin@farm.local", "password": "brovin123"})
    response = client.get("/accounting/requests")
    assert response.status_code == 303
    assert response.headers["location"] == "/accounting/"


def test_admin_complaint_response_persists_and_notifies_client(client):
    from database import SessionLocal
    from models import Complaint, Conversation, Message, Notification

    client.cookies.clear()
    client.post("/login", data={"email": "user@farm.local", "password": "user123"})
    create = client.post("/complaints/create", data={"category": "other", "text": "Need admin help with this order."})
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
        assert db.query(Notification).filter(Notification.user_id == saved.user_id).count() >= 1
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


def test_order_payment_rejects_manual_cash_bypass(client):
    from database import SessionLocal
    from models import Order, Transaction, User

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        order = Order(
            user_id=buyer.id,
            total_price=Decimal("123.45"),
            status="awaiting_payment",
            payment_status="pending",
            selected_payment_method="yookassa",
        )
        db.add(order)
        db.commit()
        order_id = order.id
    finally:
        db.close()

    client.cookies.clear()
    client.post("/login", data={"email": "user@farm.local", "password": "user123"})
    response = client.post(f"/payment/{order_id}/pay", data={"payment_method": "cash"})
    assert response.status_code == 303
    assert response.headers["location"] == f"/payment/{order_id}"

    db = SessionLocal()
    try:
        saved = db.query(Order).filter(Order.id == order_id).one()
        assert saved.payment_status == "pending"
        assert saved.status == "awaiting_payment"
        assert db.query(Transaction).filter(Transaction.order_id == order_id, Transaction.status == "completed").count() == 0
    finally:
        db.close()


def test_yookassa_webhook_does_not_trust_unverified_payload(client, monkeypatch):
    from database import SessionLocal
    from models import Order, Transaction, User, Wallet

    monkeypatch.setattr("routes.payment._fetch_yookassa_payment", lambda payment_id: (None, "not verified"))

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        wallet = Wallet(user_id=buyer.id, balance=0)
        db.add(wallet)
        db.flush()
        order = Order(
            user_id=buyer.id,
            total_price=Decimal("555.00"),
            status="awaiting_payment",
            payment_status="pending",
            selected_payment_method="yookassa",
        )
        db.add(order)
        db.flush()
        tx = Transaction(
            wallet_id=wallet.id,
            user_id=buyer.id,
            order_id=order.id,
            amount=Decimal("555.00"),
            type="payment",
            status="pending",
            payment_method="yookassa",
            external_id="fake_payment_from_test",
        )
        db.add(tx)
        db.commit()
        order_id = order.id
    finally:
        db.close()

    response = client.post("/payment/yookassa/webhook", json={
        "event": "payment.succeeded",
        "object": {
            "id": "fake_payment_from_test",
            "metadata": {"order_id": str(order_id), "user_id": "3"},
        },
    })
    assert response.status_code == 200
    assert response.json() == {"ok": False}

    db = SessionLocal()
    try:
        saved = db.query(Order).filter(Order.id == order_id).one()
        tx = db.query(Transaction).filter(Transaction.order_id == order_id).one()
        assert saved.payment_status == "pending"
        assert saved.status == "awaiting_payment"
        assert tx.status == "pending"
    finally:
        db.close()


def test_yookassa_cancel_webhook_does_not_fail_unverified_payment(client, monkeypatch):
    from database import SessionLocal
    from models import Order, Transaction, User, Wallet

    monkeypatch.setattr("routes.payment._fetch_yookassa_payment", lambda payment_id: (None, "not verified"))

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        wallet = Wallet(user_id=buyer.id, balance=0)
        db.add(wallet)
        db.flush()
        order = Order(
            user_id=buyer.id,
            total_price=Decimal("333.00"),
            status="awaiting_payment",
            payment_status="pending",
            selected_payment_method="yookassa",
        )
        db.add(order)
        db.flush()
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=buyer.id,
            order_id=order.id,
            amount=Decimal("333.00"),
            type="payment",
            status="pending",
            payment_method="yookassa",
            external_id="fake_canceled_payment",
        ))
        db.commit()
        order_id = order.id
    finally:
        db.close()

    response = client.post("/payment/yookassa/webhook", json={
        "event": "payment.canceled",
        "object": {
            "id": "fake_canceled_payment",
            "metadata": {"order_id": str(order_id), "user_id": "3"},
        },
    })
    assert response.status_code == 200
    assert response.json() == {"ok": False}

    db = SessionLocal()
    try:
        tx = db.query(Transaction).filter(Transaction.order_id == order_id).one()
        assert tx.status == "pending"
    finally:
        db.close()


def test_yookassa_return_confirms_verified_payment(client, monkeypatch):
    from database import SessionLocal
    from models import Order, Transaction, User, Wallet

    client.cookies.clear()
    client.post("/login", data={"email": "user@farm.local", "password": "user123"})

    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.email == "user@farm.local").one()
        wallet = Wallet(user_id=buyer.id, balance=0)
        db.add(wallet)
        db.flush()
        order = Order(
            user_id=buyer.id,
            total_price=Decimal("444.00"),
            status="awaiting_payment",
            payment_status="pending",
            selected_payment_method="yookassa",
        )
        db.add(order)
        db.flush()
        db.add(Transaction(
            wallet_id=wallet.id,
            user_id=buyer.id,
            order_id=order.id,
            amount=Decimal("444.00"),
            type="payment",
            status="pending",
            payment_method="yookassa",
            external_id="verified_payment_from_return",
        ))
        db.commit()
        order_id = order.id
        buyer_id = buyer.id
    finally:
        db.close()

    monkeypatch.setattr("routes.payment._fetch_yookassa_payment", lambda payment_id: ({
        "id": payment_id,
        "status": "succeeded",
        "paid": True,
        "amount": {"value": "444.00", "currency": "RUB"},
        "metadata": {"order_id": str(order_id), "user_id": str(buyer_id)},
    }, ""))

    response = client.get("/payment/yookassa/return")
    assert response.status_code == 303
    assert response.headers["location"] == "/order/orders"

    db = SessionLocal()
    try:
        saved = db.query(Order).filter(Order.id == order_id).one()
        tx = db.query(Transaction).filter(Transaction.order_id == order_id).one()
        assert saved.payment_status == "paid"
        assert saved.status == "confirmed"
        assert saved.payment_id == "verified_payment_from_return"
        assert tx.status == "completed"
    finally:
        db.close()


def test_seller_wallet_self_deposit_disabled_by_default(client):
    from database import SessionLocal
    from models import Transaction, User, WithdrawalRequest

    client.cookies.clear()
    client.post("/login", data={"email": "seller@farm.local", "password": "seller123"})
    deposit = client.post("/payment/wallet/deposit", data={"amount": "999999", "payment_method": "cash"})
    withdraw = client.post("/payment/wallet/withdraw", data={"amount": "999999"})
    assert deposit.status_code == 303
    assert withdraw.status_code == 303

    db = SessionLocal()
    try:
        seller = db.query(User).filter(User.email == "seller@farm.local").one()
        assert db.query(Transaction).filter(
            Transaction.user_id == seller.id,
            Transaction.type == "deposit",
            Transaction.status == "completed",
        ).count() == 0
        assert db.query(WithdrawalRequest).filter(
            WithdrawalRequest.seller_id == seller.id,
            WithdrawalRequest.status == "pending",
        ).count() == 0
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
    reopen = client.post(f"/conversations/{conversation_id}/status", data={"status": "open"})
    assert reopen.status_code == 303
    assert reopen.headers["location"] == f"/conversations/{conversation_id}"

    db = SessionLocal()
    try:
        saved = db.query(Conversation).filter(Conversation.id == conversation_id).one()
        assert saved.status == "open"
    finally:
        db.close()

    resolve_again = client.post(f"/conversations/{conversation_id}/status", data={"status": "resolved"})
    assert resolve_again.status_code == 303

    db = SessionLocal()
    try:
        saved = db.query(Conversation).filter(Conversation.id == conversation_id).one()
        assert saved.status == "resolved"
    finally:
        db.close()
