# Деплой на Beget VPS

Инструкция рассчитана на VPS с Ubuntu/Debian, доменом, MySQL и запуском FastAPI через `gunicorn` + `uvicorn worker` за `nginx`.

## 1. Подготовить сервер

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx mysql-server unzip certbot python3-certbot-nginx
```

Если MySQL уже выдан Beget отдельно, `mysql-server` можно не ставить, а в `DATABASE_URL` указать выданный хост, пользователя и базу.

## 2. Создать базу MySQL

```bash
sudo mysql
```

```sql
CREATE DATABASE farmmarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'farmmarket_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON farmmarket.* TO 'farmmarket_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Загрузить проект

На локальной машине соберите чистый архив:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
```

На VPS:

```bash
sudo mkdir -p /var/www/svoi-ryady
sudo chown -R $USER:$USER /var/www/svoi-ryady
unzip dipomm-release.zip -d /var/www/svoi-ryady
cd /var/www/svoi-ryady
```

## 4. Установить Python-зависимости

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 5. Создать `.env`

```bash
nano /var/www/svoi-ryady/.env
```

Минимальный production-вариант:

```env
APP_ENV=production
DATABASE_URL=mysql+pymysql://farmmarket_user:strong_password_here@127.0.0.1:3306/farmmarket?charset=utf8mb4
SESSION_SECRET_KEY=replace-with-long-random-secret
APP_BASE_URL=https://your-domain.ru
APP_SEED_DEMO_DATA=0
ENABLE_DEMO_PAYMENTS=0
ENABLE_PASSWORD_RESET_DEMO_LINKS=0
ENABLE_SELLER_WALLET_DEPOSITS=0
```

Для первого демонстрационного запуска можно временно поставить `APP_SEED_DEMO_DATA=1`, открыть сайт один раз, потом вернуть `0` и перезапустить сервис.

## 6. Проверить ручной запуск

```bash
cd /var/www/svoi-ryady
source .venv/bin/activate
gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000
```

В другом SSH-окне:

```bash
curl -I http://127.0.0.1:8000
```

Если ответ есть, остановите ручной запуск через `Ctrl+C`.

## 7. Подключить systemd

Дайте пользователю сервиса права на проект и папку загрузок:

```bash
sudo mkdir -p /var/www/svoi-ryady/static/uploads
sudo chown -R www-data:www-data /var/www/svoi-ryady
```

Скопируйте шаблон:

```bash
sudo cp /var/www/svoi-ryady/deploy/beget-vps.service /etc/systemd/system/svoi-ryady.service
sudo systemctl daemon-reload
sudo systemctl enable --now svoi-ryady
sudo systemctl status svoi-ryady
```

Логи приложения:

```bash
journalctl -u svoi-ryady -f
```

## 8. Подключить nginx

В шаблоне замените `your-domain.ru` на свой домен:

```bash
sudo cp /var/www/svoi-ryady/deploy/beget-vps.nginx.conf /etc/nginx/sites-available/svoi-ryady
sudo nano /etc/nginx/sites-available/svoi-ryady
sudo ln -s /etc/nginx/sites-available/svoi-ryady /etc/nginx/sites-enabled/svoi-ryady
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Выпустить SSL

```bash
sudo certbot --nginx -d your-domain.ru -d www.your-domain.ru
```

После SSL проверьте, что в `.env` стоит правильный адрес:

```env
APP_BASE_URL=https://your-domain.ru
```

И перезапустите приложение:

```bash
sudo systemctl restart svoi-ryady
```

## 10. Быстрая проверка после деплоя

- Открывается главная страница.
- Открывается `/login`.
- Статика из `/static/` загружается без 404.
- Можно зарегистрировать пользователя.
- В MySQL появляются новые строки.
- `journalctl -u svoi-ryady -n 100` не показывает ошибок старта.

## Частые команды

Перезапуск приложения:

```bash
sudo systemctl restart svoi-ryady
```

Обновление кода из нового архива:

```bash
sudo systemctl stop svoi-ryady
cd /var/www/svoi-ryady
unzip -o /tmp/dipomm-release.zip -d /var/www/svoi-ryady
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl start svoi-ryady
```

Проверка nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```
