# api/app/database.py
"""Database engine, session factory and shared column helpers.

Production: set DATABASE_URL to the Supabase PostgreSQL connection string.
Local dev:  leave DATABASE_URL empty and a SQLite file (api/selgo.db) is used.

Unlike the old database.py, this never quietly switches to a temporary
database when Supabase can't be reached. On Vercel that silent switch is what
wiped accounts on every redeploy, so now a broken connection fails loudly.
"""

import os
from collections.abc import Generator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import parse_qsl, unquote

from dotenv import load_dotenv
from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

API_DIR = Path(__file__).resolve().parent.parent
load_dotenv(API_DIR / ".env")

LOCAL_HOSTS = {"localhost", "127.0.0.1"}


def _postgres_url(raw: str) -> URL:
    """Builds a SQLAlchemy URL from a Supabase connection string.

    Passwords often contain characters such as @ # : that break a plain URL,
    so the string is split by hand and the password is passed on its own.
    """
    rest = raw.split("://", 1)[1]
    query_text = ""
    if "?" in rest:
        rest, query_text = rest.split("?", 1)
    netloc, _, database = rest.partition("/")

    username: Optional[str] = None
    password: Optional[str] = None
    if "@" in netloc:
        userinfo, hostinfo = netloc.rsplit("@", 1)  # last @: the password may contain @
        username, _, password = userinfo.partition(":")
        username = unquote(username)
        password = unquote(password) if password else None
    else:
        hostinfo = netloc

    host, _, port_text = hostinfo.partition(":")
    port = int(port_text) if port_text.isdigit() else None

    query = dict(parse_qsl(query_text))
    if host not in LOCAL_HOSTS:
        query.setdefault("sslmode", "require")  # Supabase expects encrypted connections

    return URL.create(
        "postgresql+psycopg2",
        username=username,
        password=password,
        host=host or None,
        port=port,
        database=unquote(database) or None,
        query=query,
    )


def _resolve_database_url() -> Union[str, URL]:
    raw = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")

    if not raw:
        # Never fall back to SQLite on Vercel: its disk is temporary, so every
        # redeploy would silently wipe all accounts. Fail loudly instead.
        if os.getenv("VERCEL"):
            raise RuntimeError(
                "DATABASE_URL is not set. Add your Supabase connection string "
                "in the Vercel project settings before deploying."
            )
        return "sqlite:///" + (API_DIR / "selgo.db").as_posix()

    if raw.startswith(("postgres://", "postgresql://", "postgresql+psycopg2://")):
        return _postgres_url(raw)
    return raw


DATABASE_URL = _resolve_database_url()
IS_SQLITE = isinstance(DATABASE_URL, str) and DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for every SQLAlchemy model."""


def utcnow() -> datetime:
    """Current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Stores datetimes as UTC and always returns them timezone-aware.

    SQLite drops timezone info while PostgreSQL keeps it. This type makes both
    behave the same so date comparisons never break between dev and prod.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: Optional[datetime], dialect: Any) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value: Optional[datetime], dialect: Any) -> Optional[datetime]:
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
