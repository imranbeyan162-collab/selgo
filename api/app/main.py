# api/app/main.py
"""Selgo API entry point.

Run from the api/ folder:
    venv/Scripts/python.exe -m uvicorn app.main:app --reload --reload-include "*.toml"
        --reload-include "*.md" --reload-include "*.txt" --port 8000
"""

import logging
import os
from typing import Dict, List

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from . import models  # noqa: F401  (registers every table on Base.metadata)
from .agents import router as agents_router
from .database import Base, engine, get_db
from .models import Agent
from .mentor import router as mentor_router
from .registry import sync_agents
from .session import router as profile_router

logger = logging.getLogger("uvicorn.error")

# Which update this code came from. /health shows it, so you can always check
# that the server is really running the latest code you unpacked.
BUILD = "selgo-rebuild-12"

# Create any missing tables. Existing tables and their data are left untouched.
Base.metadata.create_all(bind=engine)

# Load the agents defined as code in api/agents/. A problem here is logged,
# but never stops the rest of Selgo from running.
try:
    sync_agents()
except Exception:  # noqa: BLE001
    logger.exception("Loading the agents from api/agents/ failed.")


def _cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


class UTF8JSONResponse(JSONResponse):
    # Naming the encoding stops Windows PowerShell from garbling dashes,
    # quotes and non-English letters (it guesses wrong otherwise).
    media_type = "application/json; charset=utf-8"


app = FastAPI(
    title="Selgo API",
    description="AI Agents • Automated for You",
    version="0.2.0",
    default_response_class=UTF8JSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,  # visitors are recognized by the X-Client-ID header
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router)
app.include_router(mentor_router)
app.include_router(agents_router)


@app.get("/", tags=["system"])
def root() -> Dict[str, str]:
    return {"name": "Selgo API", "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> Dict[str, object]:
    db.execute(text("SELECT 1"))
    published = db.scalar(select(func.count(Agent.id)).where(Agent.is_published.is_(True)))
    return {
        "status": "ok",
        "build": BUILD,
        "database": engine.dialect.name,
        "agents_published": int(published or 0),
    }
