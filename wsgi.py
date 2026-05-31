from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

for env_dir_name in (".venv", "venv", ".venv312"):
    for candidate in (PROJECT_ROOT / env_dir_name).glob("lib/python*/site-packages"):
        if str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))

try:
    from a2wsgi import ASGIMiddleware
except ImportError as exc:
    raise RuntimeError(
        "The WSGI entry point requires a2wsgi. Install dependencies from requirements.txt first."
    ) from exc

from main import app as asgi_app


application = ASGIMiddleware(asgi_app)
