# api/app/agents.py
"""Agent Market: Selgo's agents, comments, reactions and the sandbox preview.

Agents themselves are defined as code in api/agents/ and loaded by
registry.py, so there is nothing here for creating or editing them.

Rules enforced here:
- Anyone can browse published agents and read comments. Reacting,
  commenting and previewing use the visitor's profile.
- A new agent starts at 0 likes, 0 saves, 0 boosts (nothing is auto-added).
- One like / save / boost per visitor per agent. Sending it again removes it.
- The instructions and the knowledge library are never sent to visitors.
"""

import base64
import binascii
from typing import Dict, List, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .ai import reply_or_502
from .database import get_db
from .knowledge import agent_instructions, find_passages
from .models import Agent, AgentComment, AgentKnowledge, AgentReaction, Profile
from .schemas import (
    AgentOut,
    CommentIn,
    CommentOut,
    MessageOut,
    PreviewIn,
    PreviewOut,
    ReactionOut,
    ReactionType,
)
from .session import get_optional_profile, get_profile

router = APIRouter(prefix="/agents", tags=["agents"])

PREVIEW_HISTORY = 6  # a preview is a short taste, not a full conversation


# ---------- Helpers ----------


def _photo_url(agent: Agent) -> Optional[str]:
    if not agent.expert_photo:
        return None
    if agent.expert_photo.startswith("https://"):
        return agent.expert_photo
    # The version number changes when the agent is edited, so browsers can
    # cache the photo and still see a new one straight away.
    return f"/agents/{agent.id}/photo?v={int(agent.updated_at.timestamp())}"


def _get_agent_or_404(db: Session, agent_id: int) -> Agent:
    agent = db.get(Agent, agent_id)
    if agent is None or not agent.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return agent


def _reaction_totals(db: Session, agent_ids: List[int]) -> Dict[int, Dict[str, int]]:
    """Counts likes / saves / boosts per agent straight from the reactions table."""
    totals: Dict[int, Dict[str, int]] = {
        agent_id: {"like": 0, "save": 0, "boost": 0} for agent_id in agent_ids
    }
    if not agent_ids:
        return totals

    rows = db.execute(
        select(
            AgentReaction.agent_id,
            AgentReaction.reaction_type,
            func.count(AgentReaction.id),
        )
        .where(AgentReaction.agent_id.in_(agent_ids))
        .group_by(AgentReaction.agent_id, AgentReaction.reaction_type)
    ).all()
    for agent_id, reaction_type, total in rows:
        if reaction_type in totals[agent_id]:
            totals[agent_id][reaction_type] = total
    return totals


def _build_cards(
    db: Session, agents: Sequence[Agent], viewer: Optional[Profile]
) -> List[AgentOut]:
    """Turns Agent rows into market cards with counts and the viewer's own
    reactions. viewer is None for someone who hasn't saved anything yet."""
    agent_ids = [agent.id for agent in agents]
    if not agent_ids:
        return []

    totals = _reaction_totals(db, agent_ids)

    knowledge_counts: Dict[int, int] = {}
    for agent_id, total in db.execute(
        select(AgentKnowledge.agent_id, func.count(AgentKnowledge.id))
        .where(AgentKnowledge.agent_id.in_(agent_ids))
        .group_by(AgentKnowledge.agent_id)
    ).all():
        knowledge_counts[agent_id] = total

    comment_counts: Dict[int, int] = {}
    for agent_id, total in db.execute(
        select(AgentComment.agent_id, func.count(AgentComment.id))
        .where(AgentComment.agent_id.in_(agent_ids))
        .group_by(AgentComment.agent_id)
    ).all():
        comment_counts[agent_id] = total

    my_reactions: Dict[int, List[str]] = {}
    if viewer is not None:
        for agent_id, reaction_type in db.execute(
            select(AgentReaction.agent_id, AgentReaction.reaction_type).where(
                AgentReaction.profile_id == viewer.id,
                AgentReaction.agent_id.in_(agent_ids),
            )
        ).all():
            my_reactions.setdefault(agent_id, []).append(reaction_type)

    return [
        AgentOut(
            id=agent.id,
            slug=agent.slug,
            name=agent.name,
            industry=agent.industry,
            tagline=agent.tagline,
            description=agent.description,
            monthly_price=agent.monthly_price_cents / 100,
            expert_name=agent.expert_name,
            expert_title=agent.expert_title,
            expert_bio=agent.expert_bio,
            expert_photo_url=_photo_url(agent),
            knowledge_sources=knowledge_counts.get(agent.id, 0),
            likes=totals[agent.id]["like"],
            saves=totals[agent.id]["save"],
            boosts=totals[agent.id]["boost"],
            comments=comment_counts.get(agent.id, 0),
            my_reactions=sorted(my_reactions.get(agent.id, [])),
            created_at=agent.created_at,
        )
        for agent in agents
    ]


def _comment_out(comment: AgentComment, viewer: Optional[Profile]) -> CommentOut:
    return CommentOut(
        id=comment.id,
        agent_id=comment.agent_id,
        author_name=comment.profile.display_name,
        author_avatar=comment.profile.avatar_url,
        is_mine=viewer is not None and comment.profile_id == viewer.id,
        body=comment.body,
        created_at=comment.created_at,
    )


# ---------- Market (anyone) ----------


@router.get("", response_model=List[AgentOut])
def list_agents(
    q: Optional[str] = None,
    industry: Optional[str] = None,
    viewer: Optional[Profile] = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> List[AgentOut]:
    stmt = select(Agent).where(Agent.is_published.is_(True))

    if industry and industry.strip():
        stmt = stmt.where(func.lower(Agent.industry) == industry.strip().lower())
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Agent.name.ilike(pattern),
                Agent.tagline.ilike(pattern),
                Agent.description.ilike(pattern),
                Agent.industry.ilike(pattern),
                Agent.expert_name.ilike(pattern),
            )
        )

    agents = db.scalars(stmt.order_by(Agent.created_at.desc(), Agent.id.desc())).all()
    return _build_cards(db, agents, viewer)


# Must stay above the "/{agent_id}/..." routes.
@router.get("/by-slug/{slug}", response_model=AgentOut)
def read_agent_by_slug(
    slug: str,
    viewer: Optional[Profile] = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> AgentOut:
    agent = db.scalar(select(Agent).where(Agent.slug == slug, Agent.is_published.is_(True)))
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return _build_cards(db, [agent], viewer)[0]


@router.get("/{agent_id}/photo", include_in_schema=False)
def agent_photo(agent_id: int, db: Session = Depends(get_db)) -> Response:
    agent = db.get(Agent, agent_id)
    if agent is None or not agent.expert_photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo.")
    if agent.expert_photo.startswith("https://"):
        return RedirectResponse(agent.expert_photo)
    try:
        header, encoded = agent.expert_photo.split(",", 1)
        media_type = header[len("data:"):].split(";", 1)[0] or "image/jpeg"
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No photo.")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{agent_id}", response_model=AgentOut)
def read_agent(
    agent_id: int,
    viewer: Optional[Profile] = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> AgentOut:
    agent = _get_agent_or_404(db, agent_id)
    return _build_cards(db, [agent], viewer)[0]


# ---------- Comments ----------


@router.get("/{agent_id}/comments", response_model=List[CommentOut])
def list_comments(
    agent_id: int,
    viewer: Optional[Profile] = Depends(get_optional_profile),
    db: Session = Depends(get_db),
) -> List[CommentOut]:
    agent = _get_agent_or_404(db, agent_id)
    comments = db.scalars(
        select(AgentComment)
        .options(selectinload(AgentComment.profile))
        .where(AgentComment.agent_id == agent.id)
        .order_by(AgentComment.created_at.asc(), AgentComment.id.asc())
    ).all()
    return [_comment_out(comment, viewer) for comment in comments]


@router.post(
    "/{agent_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    agent_id: int,
    payload: CommentIn,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> CommentOut:
    agent = _get_agent_or_404(db, agent_id)
    comment = AgentComment(agent_id=agent.id, profile=profile, body=payload.body)
    db.add(comment)
    db.commit()
    return _comment_out(comment, profile)


@router.delete("/{agent_id}/comments/{comment_id}", response_model=MessageOut)
def delete_comment(
    agent_id: int,
    comment_id: int,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MessageOut:
    comment = db.get(AgentComment, comment_id)
    if comment is None or comment.agent_id != agent_id or comment.profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")
    db.delete(comment)
    db.commit()
    return MessageOut(message="Comment deleted.")


# ---------- Reactions (like / save / boost) ----------


@router.post("/{agent_id}/reactions/{reaction_type}", response_model=ReactionOut)
def toggle_reaction(
    agent_id: int,
    reaction_type: ReactionType,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> ReactionOut:
    agent = _get_agent_or_404(db, agent_id)

    existing = db.scalar(
        select(AgentReaction).where(
            AgentReaction.agent_id == agent.id,
            AgentReaction.profile_id == profile.id,
            AgentReaction.reaction_type == reaction_type.value,
        )
    )

    if existing is not None:
        db.delete(existing)
        db.commit()
        active = False
    else:
        db.add(
            AgentReaction(
                agent_id=agent.id,
                profile_id=profile.id,
                reaction_type=reaction_type.value,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            # A double tap got there first. The database refused the duplicate,
            # so the visitor still has exactly one reaction.
            db.rollback()
        active = True

    totals = _reaction_totals(db, [agent.id])[agent.id]
    return ReactionOut(
        reaction_type=reaction_type,
        active=active,
        likes=totals["like"],
        saves=totals["save"],
        boosts=totals["boost"],
    )


# ---------- Sandbox preview ----------


@router.post("/{agent_id}/preview", response_model=PreviewOut)
def preview_agent(
    agent_id: int,
    payload: PreviewIn,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> PreviewOut:
    """Lets a visitor try an agent before subscribing. Nothing is stored."""
    agent = _get_agent_or_404(db, agent_id)
    prompt = agent_instructions(
        agent,
        find_passages(db, agent.id, payload.message),
        extra=(
            "This is a short sandbox preview for a visitor who is deciding whether "
            "to subscribe. Keep answers brief."
        ),
    )
    history = [
        {"role": turn.role, "content": turn.content}
        for turn in payload.history[-PREVIEW_HISTORY:]
    ]
    return PreviewOut(reply=reply_or_502(prompt, history, payload.message))
