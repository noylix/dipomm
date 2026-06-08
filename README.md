# Свои Ряды

Дипломный проект: фермерский маркетплейс на FastAPI, SQLAlchemy и React UI.

Проект закрывает основные сценарии площадки:

- покупатель ищет товары, добавляет их в корзину, оформляет заказ и отслеживает статус;
- продавец управляет товарами, заказами, доставкой и финансами;
- администратор модерирует товары и продавцов, управляет пользователями и заказами;
- бухгалтер обрабатывает выплаты, возвраты и финансовые обращения.

## Локальный запуск

1. Установите Python-зависимости:

```bash
pip install -r requirements-dev.txt
```

2. Создайте `.env` по примеру `.env.example`. Для локальной проверки можно использовать SQLite:

```env
APP_ENV=development
DATABASE_URL=sqlite:///./farmmarket.db
SESSION_SECRET_KEY=local-dev-secret
APP_SEED_DEMO_DATA=1
```

Для окружения, близкого к production, используйте MySQL:

```env
DATABASE_URL=mysql+pymysql://DB_USER:DB_PASSWORD@127.0.0.1:3306/farmmarket?charset=utf8mb4
```

3. Запустите сервер:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

4. Откройте приложение:

```text
http://127.0.0.1:8000
```

## Проверки

```bash
python -m pytest -q
npm run check:ui
```

Быстрая проверка поднятого приложения:

```text
GET /healthz
```

Ожидаемый ответ:

```json
{"ok": true}
```

## Production-переменные

Перед деплоем задайте:

```env
APP_ENV=production
DATABASE_URL=mysql+pymysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME?charset=utf8mb4
SESSION_SECRET_KEY=put-a-long-random-secret-here
APP_BASE_URL=https://your-domain.ru
APP_SEED_DEMO_DATA=0
ENABLE_DEMO_PAYMENTS=0
ENABLE_PASSWORD_RESET_DEMO_LINKS=0
ENABLE_SELLER_WALLET_DEPOSITS=0
```

Опционально для email:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=mailbox@example.com
SMTP_PASSWORD=change-this-password
SMTP_FROM=mailbox@example.com
SMTP_USE_TLS=1
```

Опционально для YooKassa:

```env
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
```

## Деплой

Основная инструкция находится в [DEPLOY.md](DEPLOY.md).

Для Beget VPS подготовлены:

- [BEGET_VPS_DEPLOY.md](BEGET_VPS_DEPLOY.md);
- [deploy/beget-vps.service](deploy/beget-vps.service);
- [deploy/beget-vps.nginx.conf](deploy/beget-vps.nginx.conf).

На VPS рекомендуемый запуск: `gunicorn main:app -k uvicorn.workers.UvicornWorker` за nginx.
Файл `wsgi.py` оставлен для классических WSGI-хостингов.

## Чистый архив для сдачи или загрузки на хостинг

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
```

Архив появится в папке `outputs/`. Скрипт исключает `.env`, локальные базы данных, логи, кеши, виртуальные окружения, `node_modules`, скриншоты и загруженные пользователями файлы.

## Тестовые учетные записи

Демо-пользователи создаются только когда `APP_SEED_DEMO_DATA=1`.

| Роль | Email | Пароль |
| --- | --- | --- |
| Администратор | `admin@farm.local` | `admin123` |
| Продавец | `seller@farm.local` | `seller123` |
| Покупатель | `user@farm.local` | `user123` |
| Бухгалтер | `brovin@farm.local` | `brovin123` |
