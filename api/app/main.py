# api/app/main.py
"""Selgo API entry point.

Run from the api/ folder:
    ../venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
"""

import os
from typing import Dict, List

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import models  # noqa: F401  (registers every table on Base.metadata)
from .database import Base, engine, get_db
from .session import router as profile_router

# Create any missing tables. Existing tables and their data are left untouched.
Base.metadata.create_all(bind=engine)


def _cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="Selgo API",
    description="AI Agents • Automated for You",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,  # visitors are recognized by the X-Client-ID header
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router)


@app.get("/", tags=["system"])
def root() -> Dict[str, str]:
    return {"name": "Selgo API", "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> Dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": engine.dialect.name}
