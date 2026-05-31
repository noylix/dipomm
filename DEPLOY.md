# Deployment Guide

## What is already prepared

- The app can now run from `DATABASE_URL` without falling back to SQLite in production.
- Session secret is read from `SESSION_SECRET_KEY`.
- Demo data can be disabled with `APP_SEED_DEMO_DATA=0`.
- YooKassa return URL is built from `APP_BASE_URL` or the current request host.

## Minimum production environment

Create a `.env` file based on `.env.example` or set the same variables in the hosting panel:

```env
APP_ENV=production
DATABASE_URL=mysql+pymysql://db_user:db_password@127.0.0.1:3306/farmmarket?charset=utf8mb4
SESSION_SECRET_KEY=change-this-to-a-long-random-secret
APP_BASE_URL=https://your-domain.example
APP_SEED_DEMO_DATA=0
```

If you use YooKassa, also set:

```env
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
```

## Upload checklist

1. Upload the whole project except local virtual environments, logs, SQLite files, and `static/uploads/`.
2. Install dependencies from `requirements.txt`.
3. Create an empty MySQL database with `utf8mb4`.
4. Set `DATABASE_URL`, `SESSION_SECRET_KEY`, `APP_BASE_URL`, and `APP_ENV=production`.
5. Start the app with `uvicorn main:app --host 0.0.0.0 --port 8000`.

## Important notes

- On first start, SQLAlchemy will create missing tables in MySQL automatically.
- In production, the app will not seed demo users or demo products unless `APP_SEED_DEMO_DATA=1`.
- Uploaded files are stored in `static/uploads/`, so that directory must be writable on the host.
- If `DATABASE_URL` or `SESSION_SECRET_KEY` is missing in production, the app will stop on startup with a clear error instead of silently using local defaults.
- If your hosting provider uses a custom start command or process manager, point it to `main:app`.

## Fast smoke test after deploy

1. Open the main page.
2. Open `/login`.
3. Register a new user.
4. Check that `/static/...` files load.
5. Create one test product or order.
6. Verify that new rows appear in MySQL.
