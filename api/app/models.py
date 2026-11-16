# api/app/models.py
"""SQLAlchemy models.

Visitor profiles and saved mentor chats. Agents, reactions and
subscriptions are added to this file in later steps.

Agents are published only by Selgo itself, so visitors have no roles:
every profile is a business using Selgo.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, UTCDateTime, utcnow


class Profile(Base):
    """One visitor. Created automatically the first time their browser does
    something that needs saving. There is no login: the browser keeps a random
    client ID and sends it with every request. Only a hash of it is stored, so
    a leaked database can't be used to take over anyone's profile."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80), default="Guest")
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, default=None)
    company_name: Mapped[Optional[str]] = mapped_column(String(160), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ChatSession(Base):
    """One saved mentor conversation. Shown under Saved chats in the drawer."""

    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
