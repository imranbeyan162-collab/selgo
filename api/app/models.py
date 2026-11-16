# api/app/models.py
"""SQLAlchemy models.

Visitor profiles, saved mentor chats, Selgo's agents with their comments,
reactions and knowledge library, subscriptions (each business's own private
copy of an agent, with its settings and conversation memory), and the
tracker's record of every task those agents do.

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
    # Slugs of the agents the mentor recommended in this answer, comma-separated.
    recommendations: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")


class Agent(Base):
    """An AI agent built and hosted by Selgo. Agents are defined as code in
    api/agents/<slug>/ and copied into this table by registry.py on startup.
    Never edit these rows by hand: change the agent's folder and push."""

    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The agent's folder name, e.g. "growth-marketing-coach". Never changes.
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str] = mapped_column(String(80), index=True)
    tagline: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    # How the agent behaves. Never shown to visitors.
    system_prompt: Mapped[str] = mapped_column(Text)
    # Money is stored in whole cents so totals never have rounding drift.
    monthly_price_cents: Mapped[int] = mapped_column(default=0)
    # False = not shown in the market (also set when a folder is removed).
    is_published: Mapped[bool] = mapped_column(default=True)
    # Fingerprints of the agent's files, so unchanged agents are skipped.
    source_hash: Mapped[str] = mapped_column(String(64), default="")
    knowledge_hash: Mapped[str] = mapped_column(String(64), default="")

    # The expert whose knowledge this agent is trained on (with their
    # permission). All four are empty for agents that aren't tied to a person.
    expert_name: Mapped[Optional[str]] = mapped_column(String(120), default=None)
    expert_title: Mapped[Optional[str]] = mapped_column(String(160), default=None)
    expert_bio: Mapped[Optional[str]] = mapped_column(Text, default=None)
    expert_photo: Mapped[Optional[str]] = mapped_column(Text, default=None)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    comments: Mapped[List["AgentComment"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    reactions: Mapped[List["AgentReaction"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    knowledge_docs: Mapped[List["AgentKnowledge"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan", passive_deletes=True
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


class AgentKnowledge(Base):
    """One file from an agent's knowledge/ folder: a book chapter, course
    notes, a transcript... These files are how an agent is "trained"."""

    __tablename__ = "agent_knowledge"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    char_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="knowledge_docs")
    chunks: Mapped[List["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", passive_deletes=True
    )


class KnowledgeChunk(Base):
    """A short passage of a knowledge document. When someone asks the agent a
    question, the best-matching passages are handed to the AI with it."""

    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    knowledge_id: Mapped[int] = mapped_column(
        ForeignKey("agent_knowledge.id", ondelete="CASCADE"), index=True
    )
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)
    text: Mapped[str] = mapped_column(Text)

    document: Mapped["AgentKnowledge"] = relationship(back_populates="chunks")


class Subscription(Base):
    """A business's own copy of an agent: its settings and its conversation
    memory (and, with the tracker, its performance reports). Many businesses
    can subscribe to the same agent; each copy is private to its owner."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint("profile_id", "agent_id", name="uq_profile_agent_subscription"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    # "trial", "active" or "cancelled". An expired trial is worked out from
    # trial_ends_at, so nothing has to run at midnight to end it.
    status: Mapped[str] = mapped_column(String(16), default="trial")
    # The price when they subscribed, so a later price change doesn't surprise them.
    price_cents: Mapped[int] = mapped_column(default=0)
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, default=None)
    # What the owner told this copy about their business, and how it should work.
    business_context: Mapped[str] = mapped_column(Text, default="")
    custom_instructions: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, default=None)

    agent: Mapped["Agent"] = relationship()
    messages: Mapped[List["WorkspaceMessage"]] = relationship(
        back_populates="subscription", cascade="all, delete-orphan", passive_deletes=True
    )


class WorkspaceMessage(Base):
    """One message between a business and its copy of an agent. These are the
    agent's memory, and what the tracker will review."""

    __tablename__ = "workspace_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    subscription: Mapped["Subscription"] = relationship(back_populates="messages")


class AgentTask(Base):
    """One piece of work a business's agent did: a message from the owner and
    the agent's answer. The tracker measures every task and reviews a sample
    of them (see monitor.py). Only the subscription's owner sees these."""

    __tablename__ = "agent_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True
    )
    # Empty when the AI failed to answer (nothing was saved to the conversation).
    question_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workspace_messages.id", ondelete="CASCADE"), default=None
    )
    answer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workspace_messages.id", ondelete="CASCADE"), default=None
    )
    succeeded: Mapped[bool] = mapped_column(default=True)
    latency_ms: Mapped[int] = mapped_column(default=0)
    # The owner's next message pushed back on this answer ("that's wrong"...).
    owner_pushback: Mapped[bool] = mapped_column(default=False)

    # Review: "skipped", "pending", "reviewing", "done" or "failed".
    review_status: Mapped[str] = mapped_column(String(16), default="skipped", index=True)
    # Why it was picked for review: "first", "random", "flagged" or "pushback".
    sample_reason: Mapped[str] = mapped_column(String(16), default="")
    claimed_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, default=None)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, default=None)
    reviewer_model: Mapped[str] = mapped_column(String(80), default="")

    # What the reviewer found.
    topic: Mapped[str] = mapped_column(String(160), default="")
    score: Mapped[Optional[int]] = mapped_column(default=None)  # 0-100
    verdict: Mapped[str] = mapped_column(String(16), default="")  # good, needs_work, problem
    answered: Mapped[Optional[bool]] = mapped_column(default=None)
    followed_instructions: Mapped[Optional[bool]] = mapped_column(default=None)
    used_knowledge: Mapped[Optional[bool]] = mapped_column(default=None)
    minutes_saved: Mapped[Optional[int]] = mapped_column(default=None)
    feedback: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

