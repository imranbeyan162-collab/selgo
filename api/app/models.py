# api/app/models.py
"""SQLAlchemy models.

Visitor profiles, saved mentor chats, and Selgo's agents with their
comments and reactions. Subscriptions are added in a later step.

Agents are published only by Selgo itself, so visitors have no roles:
every profile is a business using Selgo.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
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


class Agent(Base):
    """An AI agent built and hosted by Selgo. Only the Selgo admin publishes
    these (see require_admin in session.py)."""

    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str] = mapped_column(String(80), index=True)
    tagline: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    # How the agent behaves. Never shown to visitors.
    system_prompt: Mapped[str] = mapped_column(Text)
    # Money is stored in whole cents so totals never have rounding drift.
    monthly_price_cents: Mapped[int] = mapped_column(default=0)
    # False = a draft only the admin can see.
    is_published: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    comments: Mapped[List["AgentComment"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    reactions: Mapped[List["AgentReaction"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class AgentComment(Base):
    __tablename__ = "agent_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="comments")
    profile: Mapped["Profile"] = relationship()


class AgentReaction(Base):
    """A like, save or boost. There is no counter column anywhere: totals are
    counted from these rows, so a new agent always starts at 0 / 0 / 0, and the
    unique constraint makes a second identical reaction impossible."""

    __tablename__ = "agent_reactions"
    __table_args__ = (
        UniqueConstraint(
            "agent_id", "profile_id", "reaction_type", name="uq_agent_profile_reaction"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    reaction_type: Mapped[str] = mapped_column(String(16))  # like, save or boost
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="reactions")
