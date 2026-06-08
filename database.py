import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL as CONFIGURED_DATABASE_URL


def _resolve_database_url() -> str:
    configured = CONFIGURED_DATABASE_URL or os.getenv("DATABASE_URL")
    if configured:
        return configured

    raise RuntimeError(
        "DATABASE_URL is required. Set a MySQL connection string, for example: "
        "mysql+pymysql://user:password@host:3306/farmmarket?charset=utf8mb4"
    )


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
