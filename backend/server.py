# Supervisor entrypoint shim — the real app lives in main.py (uvicorn main:app also works).
from main import app  # noqa: F401
