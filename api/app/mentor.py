# api/app/mentor.py
"""Selgo AI Business Mentor chat, with saved chat history.

Every visitor has a profile (see session.py), so every conversation is saved
from the first message and appears under Saved chats in the drawer.

The mentor is also Selgo's matchmaker, in two phases:

1. Discovery. For the first DISCOVERY_TURNS messages of a conversation the
   mentor is not shown any agents at all. It can only ask questions and learn
   the business, and on its last discovery reply it sums up what it understood.
2. Recommending. After that (or earlier, if the person explicitly asks for
   agents) it is shown the market and recommends every agent that fits the
   problem, best fit first, whether trained on an expert or built by Selgo.

It marks its picks with a hidden line like [[agents: slug-one, slug-two]];
this file removes that line, keeps only real published agents, and sends
them back as agent cards.
"""

import os
import re
from datetime import timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .agents import build_cards
from .ai import reply_or_502
from .database import get_db, utcnow
from .knowledge import rank_texts
from .models import Agent, ChatMessage, ChatSession, Profile
from .schemas import (
    AgentOut,
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
# How many agents the mentor is shown per answer. With more agents published,
# the ones closest to the conversation are picked.
MAX_CATALOG = 12
MAX_RECOMMENDATIONS = 6
# How many of the person's messages the mentor answers with questions before
# it may recommend agents. The depth is enforced here, not left to the AI.
DISCOVERY_TURNS = 3

MENTOR_PROMPT = (
    "You are Selgo AI Mentor, a practical business mentor inside Selgo. Selgo "
    "builds and hosts AI agents that businesses subscribe to, some trained on "
    "the knowledge of well-known experts. Help the user understand their "
    "business problem, find their biggest daily bottlenecks, suggest clear next "
    "steps, and point out which tasks an AI agent could take over. Be concise, "
    "concrete and friendly. Ask one short question when you need more detail. "
    "Never invent facts about the user's business. Always reply in the same "
    "language the user writes in. Write in plain text: no Markdown symbols such "
    "as asterisks, pound signs or tables. For a list, put each item on its own "
    "line starting with a dash."
)

DISCOVERY_RULES = (
    "You are still getting to know this business, so do not recommend any "
    "agents, tools or products yet, and don't mention Selgo's agents. Build a "
    "full picture of: what the business does and sells, who its customers are, "
    "its size and team, how the work is done today and with which tools, the "
    "exact problem and where it shows up, what they have already tried, and "
    "what result they want. Each reply: briefly reflect what you learned, add "
    "one useful insight when you have one, then ask one or two focused "
    "questions about what you still don't know."
)

DISCOVERY_LAST_ROUND = (
    "This is your last discovery reply. Sum up what you understood in two or "
    "three short lines (the business, the real problem, the result they want), "
    "ask them to confirm or correct it, and tell them that next you will show "
    "the agents that fit."
)

RECOMMEND_RULES = (
    "You now understand the business well enough to recommend agents. Recommend "
    "every agent in the list that genuinely fits this business's problem, best "
    "fit first, up to six. The best fit wins, whether or not it is trained on an "
    "expert. Start with one line on what you understood, then name the best fit "
    "and say in one sentence why, then name each other fitting agent with what "
    "it would take care of. Never add agents that don't fit just to show more. "
    "Never invent agents or recommend anything that isn't in the list. If "
    "nothing in the list fits, say Selgo doesn't have that agent yet and "
    "describe what kind of agent would help. Keep helping after recommending. "
    "Don't repeat recommendations you already made unless the user asks or "
    "brings up a new problem. "
    "Whenever you recommend agents, end your reply with one last line in exactly "
    "this form, using slugs from the list: [[agents: slug-one, slug-two]]. Never "
    "write that line at any other time."
)

# The person asking outright to see agents unlocks recommendations early.
ASKS_FOR_AGENTS = re.compile(
    r"\b(?:which|what|show(?: me)?|recommend|suggest|any|best|list)\b[^.?!\n]{0,40}\bagents?\b",
    re.IGNORECASE,
)

# The hidden line the mentor adds when it recommends agents.
TAG_PATTERN = re.compile(r"`?\[\[\s*agents?\s*:\s*([^\]]*)\]\]`?", re.IGNORECASE)
SLUG_TOKEN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _daily_limit() -> int:
    """Messages one visitor may send per 24 hours. Protects the free AI quota.
    Change it with MENTOR_DAILY_LIMIT in api/.env."""
    try:
        return max(1, int(os.getenv("MENTOR_DAILY_LIMIT", "50")))
    except ValueError:
        return 50


# ---------- Recommendations ----------


def recommending_now(user_messages: int, message: str) -> bool:
    """True once discovery is over: user_messages counts the person's messages
    in this conversation, including the one being answered."""
    return user_messages > DISCOVERY_TURNS or bool(ASKS_FOR_AGENTS.search(message))


def phase_instructions(user_messages: int, message: str, catalog: Sequence[Agent]) -> str:
    """Everything the mentor is told for this answer, depending on the phase."""
    if recommending_now(user_messages, message):
        return "\n\n".join([MENTOR_PROMPT, RECOMMEND_RULES, catalog_text(catalog)])
    parts = [MENTOR_PROMPT, DISCOVERY_RULES]
    if user_messages == DISCOVERY_TURNS:
        parts.append(DISCOVERY_LAST_ROUND)
    return "\n\n".join(parts)


def split_recommendations(text: str, allowed: Sequence[str]) -> Tuple[str, List[str]]:
    """Takes the hidden [[agents: ...]] line out of the mentor's answer.
    Returns the visible text and the recommended slugs that really exist."""
    allowed_set = set(allowed)
    slugs: List[str] = []
    for match in TAG_PATTERN.finditer(text):
        for token in SLUG_TOKEN.findall(match.group(1).lower()):
            if token in allowed_set and token not in slugs:
                slugs.append(token)
    visible = TAG_PATTERN.sub("", text)
    visible = re.sub(r"[ \t]+\n", "\n", visible)
    visible = re.sub(r"\n{3,}", "\n\n", visible).strip()
    return visible, slugs[:MAX_RECOMMENDATIONS]


def _agent_text(agent: Agent) -> str:
    parts = [agent.name, agent.expert_name, agent.expert_title, agent.industry, agent.tagline, agent.description]
    return " ".join(part for part in parts if part)


def _catalog(db: Session, conversation: str) -> List[Agent]:
    """The published agents the mentor may recommend in this answer."""
    agents = list(
        db.scalars(
            select(Agent)
            .where(Agent.is_published.is_(True))
            .order_by(Agent.created_at.desc(), Agent.id.desc())
        ).all()
    )
    if len(agents) <= MAX_CATALOG:
        return agents
    best = rank_texts([_agent_text(agent) for agent in agents], conversation, MAX_CATALOG)
    chosen = set(best)
    order = best + [index for index in range(len(agents)) if index not in chosen]
    return [agents[index] for index in order[:MAX_CATALOG]]


def catalog_text(agents: Sequence[Agent]) -> str:
    if not agents:
        return "Selgo has no agents in its market yet, so never recommend one."
    lines = ["Agents in the Selgo market. Recommend only from this list, using the slug:"]
    for agent in agents:
        if agent.expert_name:
            who = f"trained on the work of {agent.expert_name}"
            if agent.expert_title:
                who += f" ({agent.expert_title})"
        else:
            who = "built by Selgo"
        price = (
            "free"
            if agent.monthly_price_cents <= 0
            else f"${agent.monthly_price_cents / 100:g} a month"
        )
        about = " ".join(agent.description.split())
        if len(about) > 160:
            about = about[:157].rstrip() + "..."
        lines.append(f"- {agent.slug}: {agent.name}, {who}. {agent.industry}, {price}. {agent.tagline}. {about}")
    return "\n".join(lines)


def _cards_for(db: Session, slugs: Sequence[str], viewer: Optional[Profile]) -> Dict[str, AgentOut]:
    """Market cards for the given slugs (published agents only), by slug."""
    if not slugs:
        return {}
    agents = db.scalars(
        select(Agent).where(Agent.slug.in_(list(set(slugs))), Agent.is_published.is_(True))
    ).all()
    return {card.slug: card for card in build_cards(db, agents, viewer)}


def _slugs(stored: str) -> List[str]:
    return [slug for slug in stored.split(",") if slug]


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


def _history_turn(message: ChatMessage) -> Dict[str, str]:
    content = message.content
    # Show the mentor its own earlier picks, so it doesn't repeat them.
    if message.role == "assistant" and message.recommendations:
        content = f"{content}\n[[agents: {', '.join(_slugs(message.recommendations))}]]"
    return {"role": message.role, "content": content}


# ---------- Chat ----------


@router.post("/chat", response_model=MentorChatOut)
def chat(
    payload: MentorChatIn,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MentorChatOut:
    session = None
    everything: List[ChatMessage] = []
    if payload.session_id is not None:
        session = _get_session_or_404(db, payload.session_id, profile)
        everything = _load_messages(db, session.id)
    earlier = everything[-MAX_HISTORY:]
    history = [_history_turn(message) for message in earlier]

    _check_daily_limit(db, profile)

    user_messages = sum(1 for m in everything if m.role == "user") + 1  # + this one
    recommending = recommending_now(user_messages, payload.message)
    catalog: List[Agent] = []
    if recommending:
        said_by_user = " ".join(m.content for m in everything if m.role == "user")
        catalog = _catalog(db, f"{said_by_user} {payload.message}")
    instructions = phase_instructions(user_messages, payload.message, catalog)

    # Ask first, save second: a failed AI call never leaves a half-saved chat.
    answer = reply_or_502(instructions, history, payload.message)
    # During discovery nothing is allowed, so any stray picks are dropped.
    reply, picked = split_recommendations(answer, [agent.slug for agent in catalog])
    if not reply:
        reply = "These agents fit what you described:" if picked else "Could you tell me a bit more?"

    if session is None:
        session = ChatSession(profile_id=profile.id, title=_title_from(payload.message))
        db.add(session)
        db.flush()  # assigns session.id

    db.add(ChatMessage(session_id=session.id, role="user", content=payload.message))
    db.flush()  # the question always gets the lower id, so order is stable
    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=reply,
            recommendations=",".join(picked),
        )
    )
    session.updated_at = utcnow()
    db.commit()

    cards = _cards_for(db, picked, profile)
    return MentorChatOut(
        reply=reply,
        session_id=session.id,
        title=session.title,
        recommendations=[cards[slug] for slug in picked if slug in cards],
    )


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
    all_slugs = [slug for message in messages for slug in _slugs(message.recommendations)]
    cards = _cards_for(db, all_slugs, profile)
    return ChatSessionDetailOut(
        id=session.id,
        title=session.title,
        updated_at=session.updated_at,
        messages=[
            ChatMessageOut(
                id=message.id,
                role=message.role,
                content=message.content,
                created_at=message.created_at,
                recommendations=[
                    cards[slug] for slug in _slugs(message.recommendations) if slug in cards
                ],
            )
            for message in messages
        ],
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
