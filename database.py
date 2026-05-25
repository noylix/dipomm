from pathlib import Path
import os
import sqlite3

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL as CONFIGURED_DATABASE_URL, IS_PRODUCTION


DEFAULT_SQLITE_URL = "sqlite:///./farmmarket.db"
FALLBACK_SQLITE_URL = "sqlite:///./runtime_test_ok.db"


def _sqlite_path_from_url(url: str) -> Path | None:
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return None
    return Path(url[len(prefix):]).resolve()


def _sqlite_file_is_healthy(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        with sqlite3.connect(path) as connection:
            row = connection.execute("PRAGMA integrity_check").fetchone()
        return bool(row) and row[0] == "ok"
    except sqlite3.Error:
        return False


def _resolve_database_url() -> str:
    configured = CONFIGURED_DATABASE_URL or os.getenv("DATABASE_URL")
    if configured:
        return configured

    if IS_PRODUCTION:
        raise RuntimeError(
            "DATABASE_URL is required when APP_ENV=production. "
            "Set a MySQL connection string before starting the app."
        )

    default_path = _sqlite_path_from_url(DEFAULT_SQLITE_URL)
    fallback_path = _sqlite_path_from_url(FALLBACK_SQLITE_URL)

    if default_path and _sqlite_file_is_healthy(default_path):
        return DEFAULT_SQLITE_URL
    if fallback_path and _sqlite_file_is_healthy(fallback_path):
        return FALLBACK_SQLITE_URL
    return DEFAULT_SQLITE_URL


DATABASE_URL = _resolve_database_url()

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite:///"):
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 20}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
