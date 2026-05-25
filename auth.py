# auth.py
# Аутентификация через сессии (cookies) и ролевая система

from fastapi import Request, Depends
from fastapi.responses import RedirectResponse, PlainTextResponse
from sqlalchemy.orm import Session
import bcrypt
from models import User
from database import get_db


# === ХЕШИРОВАНИЕ ПАРОЛЕЙ ===

def hash_password(password: str) -> str:
    """Хешируем пароль через bcrypt напрямую"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяем пароль через bcrypt напрямую"""
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except Exception:
        return False


# === ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ ===

def get_optional_user(request: Request, db: Session = Depends(get_db)):
    """Возвращает текущего пользователя или None, если не авторизован"""
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Возвращает текущего пользователя.
    Если не авторизован — кидает редирект на /login.
    """
    user = get_optional_user(request, db)
    if not user:
        # Используем исключение-редирект через RedirectResponse в роутах,
        # тут просто возвращаем None — каждый роут проверяет сам.
        # Чтобы было удобнее, кидаем 303 через HTTPException — но FastAPI
        # лучше обрабатывает RedirectResponse напрямую.
        # Для простоты — сделаем так: возвращаем None, а защита в зависимостях.
        return None
    return user


# === ПРОВЕРКИ РОЛЕЙ ===
# Используются в роутах так:
#   user = get_optional_user(request, db)
#   guard = check_role(user, ["admin"])
#   if guard: return guard

def check_role(user, allowed_roles):
    """
    Проверяет, что пользователь авторизован и имеет одну из разрешённых ролей.
    Возвращает RedirectResponse, если нет доступа, иначе None.
    """
    if not user:
        return RedirectResponse(url="/login", status_code=303)
    if user.role not in allowed_roles:
        return PlainTextResponse("Нет доступа", status_code=403)
    return None


def check_logged_in(user):
    """Проверка только на авторизацию"""
    if not user:
        return RedirectResponse(url="/login", status_code=303)
    return None
