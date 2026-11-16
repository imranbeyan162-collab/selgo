# api/app/mentor.py
"""Selgo AI Business Mentor chat, with saved chat history.

Every visitor has a profile (see session.py), so every conversation is saved
from the first message and appears under Saved chats in the drawer.
"""

import os
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .ai import reply_or_502
from .database import get_db, utcnow
from .models import ChatMessage, ChatSession, Profile
from .schemas import (
    ChatMessageOut,
    ChatSessionDetailOut,
    ChatSessionOut,
    MentorChatIn,
    MentorChatOut,
    MessageOut,
)
from .session import get_optional_profile, get_profile

router = APIRouter(prefix="/mentor", tags=["mentor"])

# How many earlier messages the model sees. Keeps replies fast and costs low.
MAX_HISTORY = 20

MENTOR_PROMPT = (
    "You are Selgo AI Mentor, a practical business mentor inside Selgo. Selgo "
    "builds and hosts its own AI agents that businesses subscribe to so routine "
    "work gets automated. Help the user understand their business problem, find "
    "their biggest daily bottlenecks, suggest clear next steps, and point out "
    "which tasks an AI agent could take over. Be concise, concrete and friendly. "
    "Ask one short question when you need more detail. Never invent facts about "
    "the user's business. Always reply in the same language the user writes in. "
    "Write in plain text: no Markdown symbols such as asterisks, pound signs or "
    "tables. For a list, put each item on its own line starting with a dash."
)


def _daily_limit() -> int:
    """Messages one visitor may send per 24 hours. Protects the free AI quota.
    Change it with MENTOR_DAILY_LIMIT in api/.env."""
    try:
        return max(1, int(os.getenv("MENTOR_DAILY_LIMIT", "50")))
    except ValueError:
        return 50


# ---------- Helpers ----------


def _title_from(text: str) -> str:
    title = " ".join(text.split())
    if len(title) > 60:
        title = title[:57].rstrip() + "..."
    return title or "New chat"


def _get_session_or_404(db: Session, session_id: int, profile: Profile) -> ChatSession:
    session = db.get(ChatSession, session_id)
    # Someone else's chat is reported as "not found" so its existence is not revealed.
    if session is None or session.profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return session


def _load_messages(db: Session, session_id: int) -> List[ChatMessage]:
    return list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.id.asc())
        ).all()
    )


def _check_daily_limit(db: Session, profile: Profile) -> None:
    since = utcnow() - timedelta(hours=24)
    sent = db.scalar(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(
            ChatSession.profile_id == profile.id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= since,
        )
    )
    if (sent or 0) >= _daily_limit():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You've reached today's mentor message limit. Please come back tomorrow.",
        )


# ---------- Chat ----------


@router.post("/chat", response_model=MentorChatOut)
def chat(
    payload: MentorChatIn,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MentorChatOut:
    session = None
    history = []
    if payload.session_id is not None:
        session = _get_session_or_404(db, payload.session_id, profile)
        earlier = _load_messages(db, session.id)[-MAX_HISTORY:]
        history = [{"role": m.role, "content": m.content} for m in earlier]

    _check_daily_limit(db, profile)

    # Ask first, save second: a failed AI call never leaves a half-saved chat.
    reply = reply_or_502(MENTOR_PROMPT, history, payload.message)

    if session is None:
        session = ChatSession(profile_id=profile.id, title=_title_from(payload.message))
        db.add(session)
        db.flush()  # assigns session.id

    db.add(ChatMessage(session_id=session.id, role="user", content=payload.message))
    db.flush()  # the question always gets the lower id, so order is stable
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply))
    session.updated_at = utcnow()
    db.commit()

    return MentorChatOut(reply=reply, session_id=session.id, title=session.title)


# ---------- Saved chats ----------


@router.get("/sessions", response_model=List[ChatSessionOut])
def list_sessions(
    profile: Optional[Profile] = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> List[ChatSession]:
    # Someone who has never chatted has no chats, and no profile is created
    # just because the drawer asked.
    if profile is None:
        return []
    return list(
        db.scalars(
            select(ChatSession)
            .where(ChatSession.profile_id == profile.id)
            .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        ).all()
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailOut)
def read_session(
    session_id: int,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> ChatSessionDetailOut:
    session = _get_session_or_404(db, session_id, profile)
    messages = _load_messages(db, session.id)
    return ChatSessionDetailOut(
        id=session.id,
        title=session.title,
        updated_at=session.updated_at,
        messages=[ChatMessageOut.model_validate(message) for message in messages],
    )


@router.delete("/sessions/{session_id}", response_model=MessageOut)
def delete_session(
    session_id: int,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MessageOut:
    session = _get_session_or_404(db, session_id, profile)
    db.delete(session)  # its messages are removed with it
    db.commit()
    return MessageOut(message="Chat deleted.")
