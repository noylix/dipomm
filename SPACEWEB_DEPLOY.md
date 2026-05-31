# SpaceWeb Deployment

## What to upload

Upload the whole project to the site directory except:

- `.venv/`
- `.venv312/`
- `node_modules/`
- `__pycache__/`
- `farmmarket.db`
- `runtime_test_ok.db`
- `uvicorn.out.log`
- `uvicorn.err.log`

Keep these files in the upload:

- `main.py`
- `wsgi.py`
- `config.py`
- `database.py`
- `models.py`
- `requirements.txt`
- `.env`
- `routes/`
- `templates/`
- `static/`

## Prepare `.env`

Create `.env` in the project root:

```env
APP_ENV=production
DATABASE_URL=mysql+pymysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME?charset=utf8mb4
SESSION_SECRET_KEY=put-a-long-random-secret-here
APP_BASE_URL=https://your-domain.ru
APP_SEED_DEMO_DATA=0

YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
```

## SpaceWeb panel steps

1. Open `Хостинг -> Базы данных`.
2. Create a MySQL database with `utf8mb4`.
3. Copy the database host, database name, login, and password into `.env`.
4. Open `Инструменты -> SSH` and enable SSH access.
5. Open `Хостинг -> Сайты` and make sure Python hosting is enabled for the site.
6. Upload the project into the site directory through `Хостинг -> Файловый менеджер`.

## Install dependencies through SSH

Open SSH in the site directory and run:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## Entry point

The project is prepared for SpaceWeb Python hosting through:

- `main.py` as the FastAPI app source
- `wsgi.py` as the WSGI entry point for Apache/mod_wsgi

If SpaceWeb asks for the startup file, specify:

```text
wsgi.py
```

If SpaceWeb asks for the callable object, specify:

```text
application
```

## First test after upload

1. Open the main page.
2. Open `/login`.
3. Register a user.
4. Check that CSS and images load from `/static/...`.
5. Create one test record in the app.
6. Confirm that data appears in MySQL.

## Important notes

- In production the app will stop on startup if `DATABASE_URL` or `SESSION_SECRET_KEY` is missing.
- Demo data is disabled when `APP_SEED_DEMO_DATA=0`.
- `static/uploads/` must be writable by the hosting environment.
- YooKassa return URL is built from `APP_BASE_URL`.
