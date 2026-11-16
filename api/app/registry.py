# api/app/registry.py
"""Agents as code.

Every Selgo agent is a folder in api/agents/ (see api/agents/README.md):

    api/agents/growth-marketing-coach/
        agent.toml        name, industry, tagline, price, expert...
        instructions.md   how the agent behaves (private)
        photo.jpg         optional expert photo
        knowledge/        .md / .txt files the agent is trained on

When the API starts, sync_agents() reads every folder and brings the database
in line with it. So deploying an agent is: add or edit its folder, commit,
push. Only people who can push to the GitHub repo can change agents, and
there is no admin page or admin password on the website at all.

- Unchanged agents are skipped (their files are fingerprinted).
- A folder with a mistake is skipped and the reason is logged; the live
  version of that agent, if any, stays as it was.
- A deleted folder hides the agent from the market but keeps its row, because
  purchases, comments and likes point at it.
"""

import base64
import hashlib
import logging
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from .database import SessionLocal, utcnow
from .knowledge import chunk_text
from .models import Agent, AgentKnowledge, KnowledgeChunk

logger = logging.getLogger("uvicorn.error")

AGENTS_DIR = Path(__file__).resolve().parent.parent / "agents"

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
KNOWLEDGE_SUFFIXES = {".md", ".markdown", ".txt"}
PHOTO_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
MAX_PHOTO_BYTES = 300_000  # keep expert photos small: about 500 x 500 pixels
MAX_INSTRUCTIONS_CHARS = 20_000
MAX_KNOWLEDGE_CHARS = 2_000_000  # per file, roughly a whole book
SYNC_LOCK_KEY = 7243001  # any fixed number: stops two servers syncing at once


class AgentFileError(Exception):
    """An agent folder has a mistake. The message says what to fix."""


# ---------- What agent.toml may contain ----------


class ExpertSpec(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    title: Optional[str] = Field(default=None, max_length=160)
    bio: Optional[str] = Field(default=None, max_length=3000)
    photo: Optional[str] = Field(default=None, max_length=200)  # a file in the agent's folder


class AgentSpec(BaseModel):
    # extra="forbid" turns a misspelled setting into a clear error.
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=120)
    industry: str = Field(min_length=2, max_length=80)
    tagline: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    monthly_price: float = Field(ge=0, le=100000)  # US dollars
    published: bool = True
    expert: Optional[ExpertSpec] = None


@dataclass
class LoadedAgent:
    slug: str
    spec: AgentSpec
    instructions: str
    photo: Optional[str]  # data URL
    knowledge: List[Tuple[str, str]] = field(default_factory=list)  # (title, text)
    source_hash: str = ""
    knowledge_hash: str = ""


# ---------- Reading one folder ----------


def _read_text(path: Path, folder: str) -> str:
    try:
        return path.read_text(encoding="utf-8-sig")  # -sig: files saved by Notepad work too
    except UnicodeDecodeError:
        raise AgentFileError(f"{folder}/{path.name} is not saved as UTF-8 text.")


def _fingerprint(parts: List[Tuple[str, bytes]]) -> str:
    digest = hashlib.sha256()
    for name, content in parts:
        digest.update(name.encode("utf-8") + b"\0")
        digest.update(hashlib.sha256(content).digest())
    return digest.hexdigest()


def _describe(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in item['loc']) or 'agent.toml'}: {item['msg']}"
        for item in error.errors()
    )


def load_agent_folder(folder: Path) -> LoadedAgent:
    slug = folder.name
    if not SLUG_PATTERN.match(slug) or len(slug) > 80:
        raise AgentFileError(
            "the folder name must be lowercase words joined by dashes, like growth-marketing-coach."
        )

    toml_path = folder / "agent.toml"
    if not toml_path.is_file():
        raise AgentFileError("agent.toml is missing.")
    try:
        spec = AgentSpec.model_validate(tomllib.loads(_read_text(toml_path, slug)))
    except tomllib.TOMLDecodeError as error:
        raise AgentFileError(f"agent.toml can't be read: {error}")
    except ValidationError as error:
        raise AgentFileError(f"agent.toml: {_describe(error)}")

    instructions_path = folder / "instructions.md"
    if not instructions_path.is_file():
        raise AgentFileError("instructions.md is missing.")
    instructions = _read_text(instructions_path, slug).strip()
    if not instructions:
        raise AgentFileError("instructions.md is empty.")
    if len(instructions) > MAX_INSTRUCTIONS_CHARS:
        raise AgentFileError(f"instructions.md is longer than {MAX_INSTRUCTIONS_CHARS} characters.")

    source_parts = [("agent.toml", toml_path.read_bytes()), ("instructions.md", instructions_path.read_bytes())]

    photo: Optional[str] = None
    if spec.expert and spec.expert.photo:
        photo_path = (folder / spec.expert.photo).resolve()
        media_type = PHOTO_TYPES.get(photo_path.suffix.lower())
        if photo_path.parent != folder.resolve() or not photo_path.is_file():
            raise AgentFileError(f"the expert photo '{spec.expert.photo}' isn't in the agent's folder.")
        if media_type is None:
            raise AgentFileError("the expert photo must be a .jpg, .png or .webp file.")
        data = photo_path.read_bytes()
        if len(data) > MAX_PHOTO_BYTES:
            raise AgentFileError(
                f"the expert photo is {len(data) // 1000} KB; keep it under {MAX_PHOTO_BYTES // 1000} KB."
            )
        photo = f"data:{media_type};base64,{base64.b64encode(data).decode('ascii')}"
        source_parts.append((photo_path.name, data))

    knowledge: List[Tuple[str, str]] = []
    knowledge_parts: List[Tuple[str, bytes]] = []
    knowledge_dir = folder / "knowledge"
    if knowledge_dir.is_dir():
        files = sorted(
            path
            for path in knowledge_dir.rglob("*")
            if path.is_file()
            and path.suffix.lower() in KNOWLEDGE_SUFFIXES
            and not path.name.startswith(".")
        )
        for path in files:
            relative = path.relative_to(knowledge_dir).as_posix()
            content = _read_text(path, slug)
            if len(content) > MAX_KNOWLEDGE_CHARS:
                raise AgentFileError(f"knowledge/{relative} is too long; split it into smaller files.")
            if content.strip():
                knowledge.append((relative.rsplit(".", 1)[0], content))
                knowledge_parts.append((relative, path.read_bytes()))

    return LoadedAgent(
        slug=slug,
        spec=spec,
        instructions=instructions,
        photo=photo,
        knowledge=knowledge,
        source_hash=_fingerprint(source_parts),
        knowledge_hash=_fingerprint(knowledge_parts),
    )


# ---------- Writing to the database ----------


def _apply(agent: Agent, item: LoadedAgent) -> None:
    spec = item.spec
    agent.name = spec.name
    agent.industry = spec.industry
    agent.tagline = spec.tagline
    agent.description = spec.description
    agent.system_prompt = item.instructions
    agent.monthly_price_cents = int(round(spec.monthly_price * 100))
    agent.is_published = spec.published
    agent.expert_name = spec.expert.name if spec.expert else None
    agent.expert_title = (spec.expert.title or None) if spec.expert else None
    agent.expert_bio = (spec.expert.bio or None) if spec.expert else None
    agent.expert_photo = item.photo
    agent.source_hash = item.source_hash
    agent.updated_at = utcnow()


def _replace_knowledge(db: Session, agent: Agent, item: LoadedAgent) -> int:
    db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.agent_id == agent.id))
    db.execute(delete(AgentKnowledge).where(AgentKnowledge.agent_id == agent.id))
    passages = 0
    for title, content in item.knowledge:
        doc = AgentKnowledge(agent_id=agent.id, title=title[:200], char_count=len(content))
        db.add(doc)
        db.flush()  # assigns doc.id
        chunks = chunk_text(content)
        db.add_all(
            KnowledgeChunk(knowledge_id=doc.id, agent_id=agent.id, position=position, text=chunk)
            for position, chunk in enumerate(chunks)
        )
        passages += len(chunks)
    agent.knowledge_hash = item.knowledge_hash
    return passages


def sync_agents(agents_dir: Path = AGENTS_DIR) -> Dict[str, int]:
    """Brings the agents table in line with the agent folders. Returns counts."""
    counts = {"found": 0, "added": 0, "updated": 0, "retrained": 0, "hidden": 0, "skipped": 0}
    if not agents_dir.is_dir():
        logger.warning("No agents folder at %s, so the market is empty.", agents_dir)
        return counts

    loaded: List[LoadedAgent] = []
    broken: Set[str] = set()
    for folder in sorted(path for path in agents_dir.iterdir() if path.is_dir()):
        if folder.name.startswith((".", "_")):
            continue  # e.g. _template or .git: not agents
        counts["found"] += 1
        try:
            loaded.append(load_agent_folder(folder))
        except AgentFileError as error:
            broken.add(folder.name)
            counts["skipped"] += 1
            logger.error("Agent '%s' was skipped: %s", folder.name, error)

    with SessionLocal() as db:
        if db.get_bind().dialect.name == "postgresql":
            # Several servers can start at once on Vercel: only one syncs at a time.
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SYNC_LOCK_KEY})

        existing = {agent.slug: agent for agent in db.scalars(select(Agent)).all()}

        for item in loaded:
            agent = existing.get(item.slug)
            if agent is None:
                agent = Agent(slug=item.slug)
                _apply(agent, item)
                db.add(agent)
                db.flush()  # assigns agent.id
                counts["added"] += 1
            elif agent.source_hash != item.source_hash:
                _apply(agent, item)
                counts["updated"] += 1
            if agent.knowledge_hash != item.knowledge_hash:
                passages = _replace_knowledge(db, agent, item)
                counts["retrained"] += 1
                logger.info("Agent '%s' trained on %d passages.", item.slug, passages)

        present = {item.slug for item in loaded} | broken
        for slug, agent in existing.items():
            if slug not in present and agent.is_published:
                agent.is_published = False
                counts["hidden"] += 1
                logger.info("Agent '%s' has no folder any more, so it is hidden.", slug)

        db.commit()

    logger.info(
        "Agents synced: %(found)d found, %(added)d added, %(updated)d updated, "
        "%(retrained)d retrained, %(hidden)d hidden, %(skipped)d skipped.",
        counts,
    )
    return counts
