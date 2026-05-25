# Фермерский маркетплейс

Простая платформа на FastAPI для продажи фермерских товаров.

## Запуск

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Убедитесь, что PostgreSQL запущен и создана база данных `farmmarket`.
   Или измените `DATABASE_URL` в `database.py`.

3. Запустите сервер:
```bash
uvicorn main:app --reload
```

4. Откройте в браузере: http://127.0.0.1:8000

## Тестовые учетные записи

| Роль  | Email               | Пароль    |
|-------|---------------------|-----------|
| admin | admin@farm.local    | admin123  |
| seller| seller@farm.local   | seller123 |
| user  | user@farm.local     | user123   |

## Архитектура

- `main.py` — точка входа
- `database.py` — подключение к PostgreSQL
- `models.py` — SQLAlchemy модели
- `auth.py` — хеширование паролей и роли
- `routes/` — API маршруты
- `templates/` — Jinja2 шаблоны
- `static/` — CSS стили
