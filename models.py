# models.py
# Модели SQLAlchemy для фермерского маркетплейса

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Numeric, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # user, seller, manager, admin, accountant
    is_approved = Column(Integer, default=1)  # 1 — одобрен, 0 — на модерации (для seller)
    min_order_amount = Column(Numeric(10, 2), default=0)  # минимальная сумма заказа для фермера
    created_at = Column(DateTime, server_default=func.now())

    # Подтверждение email
    email_verified = Column(Integer, default=0)  # 1 — email подтверждён
    verification_token = Column(String(255), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)

    # Профиль фермера (заполняется при регистрации seller)
    full_name = Column(String(255), nullable=True)  # ФИО / название хозяйства
    farm_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    inn = Column(String(20), nullable=True)
    farm_address = Column(String(500), nullable=True)
    farm_description = Column(String(2000), nullable=True)
    product_categories = Column(String(1000), nullable=True)
    farm_photo_url = Column(String(500), nullable=True)
    passport_photo_url = Column(String(500), nullable=True)
    supplier_registration_data = Column(String(1000), nullable=True)
    supplier_document_url = Column(String(500), nullable=True)
    supplier_bank_details = Column(String(1000), nullable=True)
    seller_application_status = Column(String(50), default="approved")
    seller_application_rejection_reason = Column(String(2000), nullable=True)
    seller_application_admin_comment = Column(String(2000), nullable=True)

    # Связи
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete")
    orders = relationship("Order", back_populates="user")
    products = relationship("Product", back_populates="owner", cascade="all, delete")
    reviews = relationship("Review", back_populates="user", cascade="all, delete")
    seller_reviews_written = relationship("SellerReview", foreign_keys="SellerReview.user_id", back_populates="user", cascade="all, delete")
    seller_reviews_received = relationship("SellerReview", foreign_keys="SellerReview.seller_id", back_populates="seller", cascade="all, delete")
    farm_certificates = relationship("FarmCertificate", back_populates="seller", cascade="all, delete")
    complaints_sent = relationship("Complaint", foreign_keys="Complaint.user_id", back_populates="author", cascade="all, delete")
    complaints_received = relationship("Complaint", foreign_keys="Complaint.target_user_id", back_populates="target_user", cascade="all, delete")
    conversations_bought = relationship("Conversation", foreign_keys="Conversation.buyer_id", back_populates="buyer", cascade="all, delete")
    conversations_sold = relationship("Conversation", foreign_keys="Conversation.farmer_id", back_populates="farmer", cascade="all, delete")
    conversations_admin = relationship("Conversation", foreign_keys="Conversation.admin_id", back_populates="admin", cascade="all, delete")
    conversations_accountant = relationship("Conversation", foreign_keys="Conversation.accountant_id", back_populates="accountant", cascade="all, delete")
    messages_sent = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", cascade="all, delete")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete")
    chat_messages = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="author", cascade="all, delete")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    discount_price = Column(Numeric(10, 2), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    # Категория и характеристики (модуль каталога)
    category = Column(String(100), default="Другое")  # Овощи, Мясо, Молоко, Яйца, Мёд, Зелень, Фрукты
    variety = Column(String(100), nullable=True)  # сорт
    weight_per_unit = Column(String(50), nullable=True)  # вес/упаковка, например "1 кг" или "10 шт"
    expiration_days = Column(Integer, nullable=True)  # срок годности в днях
    has_certificate = Column(Integer, default=0)  # 1 — есть сертификат качества, 0 — нет
    region = Column(String(200), nullable=True)  # регион происхождения
    stock = Column(Integer, default=0)  # остаток на складе
    unit = Column(String(50), default="\u0448\u0442")
    low_stock_threshold = Column(Integer, default=0)
    image_url = Column(String(500), nullable=True)  # URL фото товара (загруженное или внешнее)
    description = Column(String(4000), nullable=True)  # подробное описание товара
    status = Column(String(50), default="pending")  # pending, approved, rejected
    rejection_reason = Column(String(500), nullable=True)  # причина отклонения

    @property
    def stock_quantity(self):
        return int(self.stock or 0)

    @stock_quantity.setter
    def stock_quantity(self, value):
        self.stock = max(0, int(value or 0))

    # Связи
    owner = relationship("User", back_populates="products")
    cart_items = relationship("CartItem", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
    reviews = relationship("Review", back_populates="product", cascade="all, delete")


class FarmCertificate(Base):
    __tablename__ = "farm_certificates"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    seller = relationship("User", back_populates="farm_certificates")


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    quantity = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    # Связи
    user = relationship("User", back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(40), unique=True, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    total_price = Column(Numeric(10, 2), default=0)
    status = Column(String(50), default="created")  # created, paid, assembling, delivering, completed, canceled, refunded
    payment_status = Column(String(50), default="pending")  # pending, paid
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    delivery_address = Column(String(500), nullable=True)
    delivery_method = Column(String(50), nullable=True)
    delivery_slot = Column(String(100), nullable=True)
    customer_comment = Column(String(2000), nullable=True)
    selected_payment_method = Column(String(50), nullable=True)
    seller_cancel_reason = Column(String(2000), nullable=True)
    delivery_fee = Column(Numeric(10, 2), default=0)
    platform_fee = Column(Numeric(10, 2), default=0)  # комиссия площадки
    payout_status = Column(String(50), default="pending")
    payout_confirmed_at = Column(DateTime, nullable=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True)
    discount_amount = Column(Numeric(10, 2), default=0)
    escrow_status = Column(String(50), default="pending")  # pending, released, refunded
    return_status = Column(String(50), nullable=True)  # requested, approved, rejected
    return_reason = Column(String(2000), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Связи
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete")
    delivery = relationship("Delivery", back_populates="order", uselist=False, cascade="all, delete")
    coupon = relationship("Coupon", back_populates="orders")
    chat_messages = relationship("ChatMessage", back_populates="order", cascade="all, delete")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    quantity = Column(Integer, default=1)

    # Связи
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    address = Column(String(500), nullable=False)
    method = Column(String(50), nullable=False)  # courier, pickup, post
    provider = Column(String(100), nullable=True)
    external_id = Column(String(100), nullable=True)
    track_number = Column(String(100), nullable=True)
    tracking_url = Column(String(500), nullable=True)
    status = Column(String(50), default="created")
    delivery_date = Column(DateTime, nullable=True)  # желаемая дата доставки
    created_at = Column(DateTime, server_default=func.now())

    # Связи
    order = relationship("Order", back_populates="delivery")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)  # для проверки факта покупки
    rating = Column(Integer, default=5)   # 1–5
    text = Column(String(2000))
    seller_response = Column(String(2000), nullable=True)
    seller_response_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, server_default=func.now())

    # Связи
    user = relationship("User", back_populates="reviews")
    product = relationship("Product", back_populates="reviews")
    order = relationship("Order")


class SellerReview(Base):
    __tablename__ = "seller_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Integer, default=5)
    text = Column(String(2000))
    status = Column(String(50), default="approved")
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id], back_populates="seller_reviews_written")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="seller_reviews_received")
    order = relationship("Order")


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_percent = Column(Integer, default=5)  # 5–50%
    min_order = Column(Numeric(10, 2), default=0)
    valid_from = Column(DateTime, server_default=func.now())
    valid_to = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1)
    usage_count = Column(Integer, default=0)  # сколько раз использован

    orders = relationship("Order", back_populates="coupon")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # null = system-wide
    type = Column(String(50), default="email")  # email, push, sms
    subject = Column(String(500), nullable=False)
    body = Column(String(4000), nullable=False)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))       # автор жалобы
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # на кого жалуется (если на пользователя)
    target_product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)  # или на товар
    type = Column(String(100), default="product")  # product, seller, delivery
    category = Column(String(100), default="other")
    text = Column(String(2000), nullable=False)
    attachment_path = Column(String(500), nullable=True)
    status = Column(String(50), default="new")  # new, processing, resolved, rejected
    assigned_to_role = Column(String(50), default="admin")
    admin_response = Column(String(2000), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Связи
    author = relationship("User", foreign_keys=[user_id], back_populates="complaints_sent")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="complaints_received")
    target_product = relationship("Product")
    order = relationship("Order")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False, default="order_chat")
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    accountant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="open")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="conversations_bought")
    farmer = relationship("User", foreign_keys=[farmer_id], back_populates="conversations_sold")
    admin = relationship("User", foreign_keys=[admin_id], back_populates="conversations_admin")
    accountant = relationship("User", foreign_keys=[accountant_id], back_populates="conversations_accountant")
    order = relationship("Order")
    product = relationship("Product")
    complaint = relationship("Complaint")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sender_role = Column(String(50), nullable=False)
    text = Column(String(2000), nullable=False)
    attachment_path = Column(String(500), nullable=True)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="messages_sent")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    message = Column(String(2000), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="chat_messages")
    author = relationship("User", foreign_keys=[sender_id], back_populates="chat_messages")
    recipient = relationship("User", foreign_keys=[recipient_id])


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(500), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    created_at = Column(DateTime, server_default=func.now())

    # Связи
    user = relationship("User")
    product = relationship("Product")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    balance = Column(Numeric(10, 2), default=0)
    currency = Column(String(10), default="RUB")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Связи
    user = relationship("User")
    transactions = relationship("Transaction", back_populates="wallet", cascade="all, delete")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(String(50), nullable=False)  # deposit, withdrawal, payment, refund
    status = Column(String(50), default="pending")  # pending, completed, failed
    payment_method = Column(String(50), nullable=True)  # card, wallet, cash
    description = Column(String(500), nullable=True)
    external_id = Column(String(255), nullable=True)  # ID внешней платёжной системы
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Связи
    user = relationship("User", back_populates="transactions")
    wallet = relationship("Wallet", back_populates="transactions")
    order = relationship("Order")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String(50), nullable=False)  # card, bank_transfer, cash
    provider = Column(String(100), nullable=True)  # visa, mastercard, sbp, etc.
    last_digits = Column(String(10), nullable=True)  # последние цифры карты
    is_default = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    # Связи
    user = relationship("User")
