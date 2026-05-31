"""Расширенное демо-наполнение: фермеры, товары, хиты (заказы), отзывы."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from auth import hash_password
from farmer_applications import ensure_seller_application_number
from models import (
    FarmCertificate,
    Order,
    OrderItem,
    PlatformSetting,
    Product,
    Review,
    SellerReview,
    User,
)

DEMO_CATALOG_SEED_KEY = "demo_catalog_seed_version"
DEMO_CATALOG_SEED_VERSION = "v2"

IMAGES = {
    "Овощи": "/static/product-images/vegetables-herbs.jpg",
    "Зелень": "/static/product-images/green-produce.jpg",
    "Фрукты": "/static/product-images/fruits-berries.jpg",
    "Ягоды": "/static/product-images/fruits-berries.jpg",
    "Молоко": "/static/product-images/dairy-eggs.jpg",
    "Сыры": "/static/product-images/dairy-eggs.jpg",
    "Яйца": "/static/product-images/dairy-eggs.jpg",
    "Мёд": "/static/product-images/basket-hits.jpg",
    "Мясо": "/static/product-images/bread-vegetables.jpg",
    "Птица": "/static/product-images/bread-vegetables.jpg",
    "Хлеб": "/static/product-images/bread-vegetables.jpg",
    "Бакалея": "/static/product-images/basket-hits.jpg",
    "Напитки": "/static/product-images/fruits-berries.jpg",
    "Консервы": "/static/product-images/vegetables-herbs.jpg",
    "Заморозка": "/static/product-images/green-produce.jpg",
    "Сладости": "/static/product-images/basket-hits.jpg",
    "default": "/static/product-images/green-produce.jpg",
}


def _image_for_category(category: str) -> str:
    return IMAGES.get(category, IMAGES["default"])


SELLER_SPECS = [
    {
        "email": "seller@farm.local",
        "password": "seller123",
        "full_name": "Пётр Петрович Петров",
        "farm_name": "Ферма Петровых",
        "phone": "+7 (905) 111-22-33",
        "farm_address": "Московская область, Одинцовский район, д. Петрово, 12",
        "pickup_address": "Московская область, Одинцовский район, д. Петрово, 12",
        "product_categories": "Овощи, Фрукты, Молоко, Яйца, Мёд",
        "farm_description": (
            "Семейное хозяйство с 1998 года: овощи, фрукты, молоко и яйца с ежедневной сборкой. "
            "Работаем без посредников, доставляем по области и принимаем самовывоз."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1517758478390-c89333af4642?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller2@farm.local",
        "password": "seller123",
        "full_name": "Сергей Иванович Иванов",
        "farm_name": "Овощная ферма Ивановых",
        "phone": "+7 (903) 222-33-44",
        "farm_address": "Ленинградская область, Гатчинский район, пос. Северный, 5",
        "pickup_address": "Ленинградская область, Гатчинский район, пос. Северный, 5",
        "product_categories": "Овощи, Зелень, Заморозка",
        "farm_description": (
            "Специализируемся на овощах и зелени: теплицы и открытый грунт, сбор два раза в неделю. "
            "Есть доставка по Ленобласти и пункт самовывоза у фермы."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller3@farm.local",
        "password": "seller123",
        "full_name": "Анна Васильевна Васильева",
        "farm_name": "Молочная ферма Васильевых",
        "phone": "+7 (916) 333-44-55",
        "farm_address": "Тульская область, Ясногорский район, с. Васильево, 3",
        "pickup_address": "Тульская область, Ясногорский район, с. Васильево, 3",
        "product_categories": "Молоко, Сыры, Яйца, Сладости",
        "farm_description": (
            "Молочные продукты и сыры собственного производства. Коровы на натуральном корме, "
            "пастеризация на месте, короткий срок от фермы до покупателя."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1628088062858-aa19112e51b7?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller4@farm.local",
        "password": "seller123",
        "full_name": "Дмитрий Смирнов",
        "farm_name": "Пасека «Медовый край»",
        "phone": "+7 (923) 444-55-66",
        "farm_address": "Алтайский край, Смоленский район, с. Медовое, 1",
        "pickup_address": "Алтайский край, Смоленский район, с. Медовое, 1",
        "product_categories": "Мёд, Бакалея, Консервы",
        "farm_description": (
            "Пасека на Алтае: липовый, гречишный и цветочный мёд, соты и прополис. "
            "Отправляем по России, на маркетплейсе — только свежие партии сезона."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller5@farm.local",
        "password": "seller123",
        "full_name": "Алексей Козлов",
        "farm_name": "Ферма «Козловъ»",
        "phone": "+7 (910) 555-66-77",
        "farm_address": "Краснодарский край, Славянский район, х. Козлов, 8",
        "pickup_address": "Краснодарский край, Славянский район, х. Козлов, 8",
        "product_categories": "Мясо, Птица, Яйца",
        "farm_description": (
            "Мясо и птица выращены на свободном выгуле. Разделка по запросу, охлаждённая доставка "
            "в день заказа по Краснодарскому краю."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1548550025-2bdb2c4b9f87?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller6@farm.local",
        "password": "seller123",
        "full_name": "Мария Фёдорова",
        "farm_name": "Пекарня и теплица Фёдоровых",
        "phone": "+7 (905) 777-88-99",
        "farm_address": "Владимирская область, Суздальский район, ул. Пекарская, 4",
        "pickup_address": "Владимирская область, Суздальский район, ул. Пекарская, 4",
        "product_categories": "Хлеб, Бакалея, Овощи",
        "farm_description": (
            "Домашний хлеб на закваске, выпечка и овощи из теплицы. Пекарня работает с раннего утра, "
            "выпечка дня — в каталоге каждое утро."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
    {
        "email": "seller7@farm.local",
        "password": "seller123",
        "full_name": "Елена Николаева",
        "farm_name": "Ягодная поляна",
        "phone": "+7 (921) 888-99-00",
        "farm_address": "Карелия, Прионежский район, пос. Ягодное, 2",
        "pickup_address": "Карелия, Прионежский район, пос. Ягодное, 2",
        "product_categories": "Ягоды, Фрукты, Заморозка, Напитки",
        "farm_description": (
            "Ягоды северного региона: клубника, голубика, смородина. Летом — свежие, зимой — "
            "заморозка быстрой заморозки без лишней воды."
        ),
        "farm_photo_url": "https://images.unsplash.com/photo-1464965911861-746a04a4ca0f?auto=format&fit=crop&fm=jpg&q=60&w=1200",
    },
]


# seller_email, name, category, variety, unit, price, discount_price|None, stock, description, hit_qty
PRODUCT_SPECS = [
    # Ферма Петровых — дополнения
    ("seller@farm.local", "Морковь мытая", "Овощи", "Нантская", "кг", 65, 49, 120, "Сладкая морковь, мытая и без хвостиков. Удобна для супов и запекания.", 0),
    ("seller@farm.local", "Капуста белокочанная", "Овощи", "Слава", "кг", 55, None, 90, "Плотные кочаны, хрустят в салате. Срез по запросу.", 25),
    ("seller@farm.local", "Сметана 20%", "Молоко", "Домашняя", "шт", 110, 95, 40, "Густая сметана из цельного молока, без загустителей.", 60),
    ("seller@farm.local", "Творог зернистый", "Молоко", "Деревенский", "шт", 160, 139, 35, "Нежный творог 9% жирности, свежий каждые двое суток.", 45),
    ("seller@farm.local", "Груши Конференц", "Фрукты", "Конференц", "кг", 195, 169, 45, "Сочные груши, хранятся до двух недель в холодильнике.", 0),
    # Ивановы — овощи
    ("seller2@farm.local", "Салат листовой микс", "Зелень", "Микс", "шт", 120, 99, 50, "Свежий микс рукколы, шпината и мангольда. Собран утром.", 0),
    ("seller2@farm.local", "Шпинат молодой", "Зелень", "Бэби", "кг", 280, 239, 30, "Нежные листья, без крупных жилок. Для салатов и смузи.", 35),
    ("seller2@farm.local", "Свёкла отборная", "Овощи", "Бордо", "кг", 48, 39, 150, "Сладкая свёкла для борща и запекания.", 20),
    ("seller2@farm.local", "Кабачки молодые", "Овощи", "Цукини", "кг", 75, None, 80, "Небольшие кабачки, нежная кожура, без крупных семян.", 0),
    ("seller2@farm.local", "Брокколи свежая", "Овощи", "Калабрезе", "кг", 210, 179, 40, "Плотные соцветия, ярко-зелёный цвет.", 55),
    ("seller2@farm.local", "Замороженная зелёный горошек", "Заморозка", "Быстрая заморозка", "шт", 185, 159, 60, "Шоковая заморозка сразу после сбора.", 30),
    ("seller2@farm.local", "Укроп пучок", "Зелень", "Свежий", "шт", 45, None, 100, "Ароматный укроп, пучки по 50 г.", 0),
    ("seller2@farm.local", "Петрушка корневая", "Овощи", "Сахарная", "кг", 90, 75, 70, "Сладкая корнеплодная петрушка.", 0),
    # Васильевы — молочка
    ("seller3@farm.local", "Молоко 3,2% пастеризованное", "Молоко", "Цельное", "шт", 95, 85, 80, "Пастеризованное молоко, срок годности 5 суток.", 120),
    ("seller3@farm.local", "Кефир 1%", "Молоко", "Домашний", "шт", 78, None, 70, "Классический кефир на закваске.", 40),
    ("seller3@farm.local", "Сыр «Сулугуни»", "Сыры", "Копчёный", "шт", 480, 429, 25, "Умеренно солёный, хорошо плавится на сковороде.", 85),
    ("seller3@farm.local", "Сыр твёрдый выдержанный", "Сыры", "12 месяцев", "кг", 890, 799, 15, "Выдержка 12 месяцев, ореховые ноты.", 50),
    ("seller3@farm.local", "Йогурт натуральный", "Молоко", "Без добавок", "шт", 65, 55, 90, "Густой йогурт без сахара и ароматизаторов.", 0),
    ("seller3@farm.local", "Сливки 33%", "Молоко", "Для взбивания", "шт", 145, 129, 40, "Подходят для крема и соусов.", 0),
    ("seller3@farm.local", "Творожная запеканка", "Сладости", "Домашняя", "шт", 220, 189, 20, "Готовим на ферме, без консервантов.", 0),
    ("seller3@farm.local", "Масло сливочное 82,5%", "Молоко", "Фермерское", "шт", 320, 289, 30, "Из сливок собственного производства.", 70),
    # Смирнов — мёд
    ("seller4@farm.local", "Мёд липовый", "Мёд", "Липа", "шт", 520, 469, 35, "Светлый ароматный мёд, урожай прошлого сезона.", 95),
    ("seller4@farm.local", "Мёд гречишный", "Мёд", "Гречиха", "шт", 490, None, 40, "Тёмный мёд с характерной терпкостью.", 80),
    ("seller4@farm.local", "Мёд цветочный", "Мёд", "Разнотравье", "шт", 450, 399, 45, "Лёгкий вкус луговых трав.", 0),
    ("seller4@farm.local", "Прополис настойка", "Бакалея", "20 мл", "шт", 280, 249, 25, "Настойка собственного производства.", 0),
    ("seller4@farm.local", "Варенье из смородины", "Консервы", "Домашнее", "шт", 350, 299, 30, "Густое варенье без загустителей.", 40),
    ("seller4@farm.local", "Мёд в сотах", "Мёд", "Соты", "шт", 680, 599, 18, "Натуральные соты, удобно для чая.", 65),
    # Козлов — мясо
    ("seller5@farm.local", "Куриное филе охлаждённое", "Птица", "Бройлер", "кг", 420, 379, 40, "Филе без кожи, разделка в день заказа.", 150),
    ("seller5@farm.local", "Яйца перепелиные", "Яйца", "Перепел", "шт", 120, 99, 50, "Упаковка 20 яиц, свежие.", 0),
    ("seller5@farm.local", "Фарш говяжий", "Мясо", "Домашний", "кг", 650, 589, 25, "Из мяса собственного поголовья, жирность 20%.", 110),
    ("seller5@farm.local", "Утиная грудка", "Птица", "Мулард", "кг", 780, None, 15, "Нежное мясо, подходит для запекания.", 0),
    ("seller5@farm.local", "Куриные крылья", "Птица", "Охлаждённые", "кг", 290, 259, 35, "Для гриля и духовки.", 90),
    ("seller5@farm.local", "Филе индейки", "Птица", "Индейка", "кг", 520, 469, 30, "Диетическое мясо, нежное.", 75),
    # Фёдорова — хлеб
    ("seller6@farm.local", "Батон на закваске", "Хлеб", "Закваска", "шт", 95, 79, 25, "Ржано-пшеничный, корка хрустящая.", 0),
    ("seller6@farm.local", "Булочки с корицей", "Хлеб", "Свежие", "шт", 55, 45, 40, "Выпекаем каждое утро.", 55),
    ("seller6@farm.local", "Помидоры тепличные", "Овощи", "Черри", "кг", 320, 279, 50, "Сладкие черри на ветке.", 0),
    ("seller6@farm.local", "Круассаны сливочные", "Хлеб", "Классика", "шт", 75, None, 30, "Слоёная выпечка, 80 г.", 80),
    ("seller6@farm.local", "Гречка зелёная", "Бакалея", "Ядрица", "кг", 110, 95, 80, "Цельная гречка, фасовка на ферме.", 0),
    ("seller6@farm.local", "Пирог с капустой", "Хлеб", "Домашний", "шт", 280, 249, 12, "Печём в печи, готов к разогреву.", 0),
    # Николаева — ягоды
    ("seller7@farm.local", "Клубника свежая", "Ягоды", "Эльсанта", "кг", 450, 399, 35, "Крупная ягода, сладкая.", 130),
    ("seller7@farm.local", "Голубика садовая", "Ягоды", "Блюкроп", "кг", 890, 799, 20, "Плотные ягоды, хорошо хранятся.", 100),
    ("seller7@farm.local", "Малина свежая", "Ягоды", "Лячка", "кг", 620, None, 25, "Ароматная малина, сбор вручную.", 0),
    ("seller7@farm.local", "Смородина чёрная", "Ягоды", "Сортовая", "кг", 380, 329, 40, "Кисло-сладкая, для варенья и морсов.", 70),
    ("seller7@farm.local", "Замороженная клубника", "Заморозка", "Быстрая заморозка", "шт", 320, 279, 55, "Целые ягоды, шоковая заморозка.", 45),
    ("seller7@farm.local", "Морс ягодный", "Напитки", "Домашний", "шт", 180, 159, 45, "Без сахара, пастеризованный.", 0),
    ("seller7@farm.local", "Вишня замороженная", "Заморозка", "Без косточки", "шт", 290, 249, 50, "Очищенная вишня для выпечки.", 0),
    ("seller7@farm.local", "Арбуз бессемянный", "Фрукты", "Кримсон", "кг", 45, 39, 200, "Сладкий, сочный, доставляем целым.", 0),
]


def _seed_already_applied(db: Session) -> bool:
    row = db.query(PlatformSetting).filter(PlatformSetting.key == DEMO_CATALOG_SEED_KEY).first()
    return bool(row and row.value == DEMO_CATALOG_SEED_VERSION)


def _upsert_seller(db: Session, spec: dict) -> User:
    user = db.query(User).filter(User.email == spec["email"]).first()
    if not user:
        user = User(
            email=spec["email"],
            password_hash=hash_password(spec["password"]),
            role="seller",
            is_approved=1,
            email_verified=1,
            seller_application_status="approved",
        )
        db.add(user)
        db.flush()
        ensure_seller_application_number(user)
    user.full_name = spec["full_name"]
    user.farm_name = spec["farm_name"]
    user.phone = spec["phone"]
    user.farm_address = spec["farm_address"]
    user.pickup_address = spec["pickup_address"]
    user.pickup_enabled = 1
    user.farmer_delivery_enabled = 1
    user.farmer_delivery_fee = user.farmer_delivery_fee or Decimal("350")
    user.product_categories = spec["product_categories"]
    user.farm_description = spec["farm_description"]
    user.farm_photo_url = spec["farm_photo_url"]
    user.is_approved = 1
    user.seller_application_status = "approved"
    if not user.seller_application_number:
        ensure_seller_application_number(user)
    return user


def _upsert_product(db: Session, owner_id: int, spec: tuple) -> Product | None:
  # unpack
    (
        _email,
        name,
        category,
        variety,
        unit,
        price,
        discount_price,
        stock,
        description,
        _hit_qty,
    ) = spec
    existing = (
        db.query(Product)
        .filter(Product.owner_id == owner_id, Product.name == name)
        .first()
    )
    if existing:
        if not existing.description:
            existing.description = description
        if not existing.image_url:
            existing.image_url = _image_for_category(category)
        if existing.status != "approved":
            existing.status = "approved"
        existing.has_certificate = 1
        return existing
    product = Product(
        name=name,
        price=Decimal(str(price)),
        discount_price=Decimal(str(discount_price)) if discount_price else None,
        owner_id=owner_id,
        category=category,
        variety=variety,
        weight_per_unit=f"1 {unit}" if unit in {"кг", "л"} else f"1 {unit}",
        expiration_days=14 if category in {"Овощи", "Зелень", "Ягоды", "Фрукты"} else 30,
        has_certificate=1,
        region="Россия",
        stock=stock,
        unit=unit,
        low_stock_threshold=5,
        status="approved",
        image_url=_image_for_category(category),
        description=description,
    )
    db.add(product)
    db.flush()
    return product


def _seed_hit_orders(db: Session, hit_products: list[tuple[Product, int]]) -> None:
    buyer = db.query(User).filter(User.email == "user@farm.local").first()
    if not buyer or not hit_products:
        return
    for product, quantity in hit_products:
        if quantity <= 0:
            continue
        order = Order(
            user_id=buyer.id,
            total_price=Decimal(str(float(product.price) * quantity)),
            status="completed",
            payment_status="paid",
            paid_at=datetime.utcnow(),
            customer_name=buyer.full_name or "Покупатель",
            customer_phone=buyer.phone,
            delivery_method="pickup",
        )
        db.add(order)
        db.flush()
        order.order_number = f"FM-DEMO-{order.id:05d}"
        db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=quantity))


def _seed_reviews(db: Session, products: list[Product]) -> None:
    buyers = []
    for email, password in [
        ("buyer1@farm.local", "buyer123"),
        ("buyer2@farm.local", "buyer456"),
        ("buyer4@farm.local", "buyer000"),
    ]:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                password_hash=hash_password(password),
                role="user",
                is_approved=1,
                email_verified=1,
                full_name=email.split("@")[0].replace("buyer", "Покупатель "),
            )
            db.add(user)
            db.flush()
        buyers.append(user)
    texts = [
        (5, "Отличное качество, буду заказывать снова."),
        (5, "Свежий продукт, упаковка аккуратная."),
        (4, "Вкусно, доставка вовремя."),
        (5, "Соответствует описанию на 100%."),
    ]
    for index, product in enumerate(products[:24]):
        buyer = buyers[index % len(buyers)]
        if db.query(Review).filter(Review.user_id == buyer.id, Review.product_id == product.id).first():
            continue
        rating, text = texts[index % len(texts)]
        db.add(
            Review(
                user_id=buyer.id,
                product_id=product.id,
                rating=rating,
                text=text,
                status="approved",
            )
        )


def _seed_seller_reviews(db: Session, sellers: list[User]) -> None:
    buyer = db.query(User).filter(User.email == "user@farm.local").first()
    if not buyer:
        return
    for seller in sellers:
        if seller.email == "seller@farm.local":
            continue
        if db.query(SellerReview).filter(SellerReview.user_id == buyer.id, SellerReview.seller_id == seller.id).first():
            continue
        db.add(
            SellerReview(
                user_id=buyer.id,
                seller_id=seller.id,
                rating=5,
                text=f"Хороший продавец {seller.farm_name}: свежие продукты и вежливое общение.",
                status="approved",
            )
        )


def _seed_certificates(db: Session, sellers: list[User]) -> None:
    for seller in sellers:
        title = f"Сертификат качества — {seller.farm_name}"
        if db.query(FarmCertificate).filter(FarmCertificate.seller_id == seller.id, FarmCertificate.title == title).first():
            continue
        db.add(
            FarmCertificate(
                seller_id=seller.id,
                title=title,
                image_url="https://images.unsplash.com/photo-1452378174528-3090a4bba7b2?auto=format&fit=crop&fm=jpg&q=60&w=1200",
            )
        )


def seed_extended_demo_catalog(db: Session) -> None:
    if _seed_already_applied(db):
        return

    sellers = [_upsert_seller(db, spec) for spec in SELLER_SPECS]
    sellers_by_email = {seller.email: seller for seller in sellers}

    created_products: list[Product] = []
    hit_targets: list[tuple[Product, int]] = []

    for spec in PRODUCT_SPECS:
        seller = sellers_by_email.get(spec[0])
        if not seller:
            continue
        product = _upsert_product(db, seller.id, spec)
        if not product:
            continue
        created_products.append(product)
        hit_qty = spec[9]
        if hit_qty > 0:
            hit_targets.append((product, hit_qty))

    _seed_hit_orders(db, hit_targets)
    _seed_reviews(db, created_products)
    _seed_seller_reviews(db, sellers)
    _seed_certificates(db, sellers)

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == DEMO_CATALOG_SEED_KEY).first()
    if setting:
        setting.value = DEMO_CATALOG_SEED_VERSION
    else:
        db.add(PlatformSetting(key=DEMO_CATALOG_SEED_KEY, value=DEMO_CATALOG_SEED_VERSION))
    db.commit()
