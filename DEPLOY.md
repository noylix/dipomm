# Deployment Guide

## What is already prepared

- The app now requires `DATABASE_URL`; use MySQL for normal runs and production.
- Session secret is read from `SESSION_SECRET_KEY`.
- Demo data can be disabled with `APP_SEED_DEMO_DATA=0`.
- YooKassa return URL is built from `APP_BASE_URL` or the current request host.
- `/healthz` verifies that the application can execute a database query.

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

## VPS deployment

For Beget VPS, use the dedicated guide and templates:

- `BEGET_VPS_DEPLOY.md`
- `deploy/beget-vps.service`
- `deploy/beget-vps.nginx.conf`

The VPS path runs the app with `gunicorn main:app -k uvicorn.workers.UvicornWorker` behind `nginx`. The `wsgi.py` file is only useful for classic WSGI hosting panels and is not the preferred VPS entrypoint.

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
- If `DATABASE_URL` is missing, the app will stop on startup with a clear error instead of silently using local SQLite.
- If your hosting provider uses a custom start command or process manager, point it to `main:app`.

## Fast smoke test after deploy

1. Open `/healthz`; the response must be `{"ok":true}`.
2. Open the main page.
3. Open `/login`.
4. Register a new user.
5. Check that `/static/...` files load.
6. Create one test product or order.
7. Verify that new rows appear in MySQL.

## Final local checks before upload

```bash
python -m pytest -q
npm run check:ui
```

On Windows, build a clean upload archive with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
```
