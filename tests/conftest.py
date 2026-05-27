"""Pytest fixtures: spin up a fresh app instance with an isolated SQLite db per test session."""

import os
import sys
import tempfile
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture(scope="session")
def app():
    # Use a throwaway sqlite file so the real farmmarket.db is untouched.
    tmp_dir = Path(tempfile.mkdtemp(prefix="dipomm_test_"))
    db_path = tmp_dir / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["APP_ENV"] = "development"
    os.environ["APP_SEED_DEMO_DATA"] = "1"
    os.environ["SESSION_SECRET_KEY"] = "test-session-secret"
    # Re-import in fresh sys.modules state.
    for mod in list(sys.modules):
        if mod in ("main", "database", "config", "models") or mod.startswith("routes."):
            sys.modules.pop(mod, None)
    import main as main_module  # noqa: WPS433  (test-time import)
    yield main_module.app


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    with TestClient(app, follow_redirects=False) as test_client:
        yield test_client
