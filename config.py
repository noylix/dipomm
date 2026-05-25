import os
from pathlib import Path


def _load_dotenv_file() -> None:
    env_candidates = [
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent / ".env.production",
    ]
    for env_path in env_candidates:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"").strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv_file()


def _normalize_env(value: str | None) -> str:
    return (value or "").strip().lower()


APP_ENV = _normalize_env(os.getenv("APP_ENV")) or "development"
IS_PRODUCTION = APP_ENV in {"prod", "production"}

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "").strip()
APP_BASE_URL = os.getenv("APP_BASE_URL", "").strip().rstrip("/")


def env_flag(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return _normalize_env(raw_value) in {"1", "true", "yes", "on"}


AUTO_SEED_DEMO_DATA = env_flag("APP_SEED_DEMO_DATA", default=not IS_PRODUCTION)

if IS_PRODUCTION and not SESSION_SECRET_KEY:
    raise RuntimeError(
        "SESSION_SECRET_KEY is required when APP_ENV=production. "
        "Set a long random secret before starting the app."
    )
