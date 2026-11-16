# api/app/monitor.py
"""The tracker: watches every business's agent at work and reports to its owner.

- Every exchange (the owner's message and the agent's answer) is logged as a
  task: when it happened, how long the answer took, and whether the AI
  answered at all.
- A sample of tasks is reviewed by a separate reviewer model (REVIEW_MODEL):
  the first few tasks of every subscription, a random share of the rest, and
  anything that looks wrong (the agent said it couldn't answer, or the owner
  pushed back in their next message).
- The reviewer scores each task, says whether it dealt with the request and
  followed the owner's instructions, estimates the time it saved, and writes
  one or two sentences on what to improve.
- Reviews run in the background after each answer, catch up when the owner
  opens the report, and can run on a schedule through POST /monitor/run.
- Only the owner of a subscription ever sees its report.

The pattern checks below (couldn't answer, pushback) understand English
only. Reviews themselves work in any language.
"""

import hmac
import json
import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from .ai import AIError, generate_reply, main_model
from .database import SessionLocal, get_db, utcnow
from .knowledge import find_passages
from .models import AgentTask, Subscription, WorkspaceMessage
from .schemas import TrackerFinding, TrackerReport, TrackerWeek

router = APIRouter(prefix="/monitor", tags=["monitor"])
logger = logging.getLogger("uvicorn.error")

DEFAULT_REVIEW_MODEL = "qwen/qwen3.6-27b"  # free on Groq, and a different model from the agents
REPORT_DAYS = 30
STALE_CLAIM = timedelta(minutes=10)  # a review that started but never finished is retried
MAX_FINDINGS = 5

CANT_ANSWER = re.compile(
    r"\b(?:i (?:don't|do not|can't|cannot) (?:know|help|answer)|i'?m not (?:able|sure)|"
    r"(?:isn't|is not|not) covered|outside (?:my|the) (?:knowledge|scope))\b",
    re.IGNORECASE,
)
PUSHBACK = re.compile(
    r"\b(?:that'?s (?:wrong|incorrect|not (?:right|true|what i (?:asked|meant|wanted)))|"
    r"you'?re wrong|not helpful|(?:doesn't|didn't|does not|did not) help|useless|"
    r"you (?:didn't|did not) (?:answer|understand|listen)|not what i (?:asked|meant|wanted))\b",
    re.IGNORECASE,
)


def _env_int(name: str, default: int, low: int, high: int) -> int:
    try:
        return min(high, max(low, int(os.getenv(name, str(default)))))
    except ValueError:
        return default


def review_model() -> str:
    return os.getenv("REVIEW_MODEL", "").strip() or DEFAULT_REVIEW_MODEL


# ---------- Logging tasks ----------


def sample_reason(earlier_tasks: int, reply: str) -> str:
    """Why this task should be reviewed, or "" if it doesn't need to be."""
    if earlier_tasks < _env_int("MONITOR_FIRST_TASKS", 5, 0, 100):
        return "first"
    if CANT_ANSWER.search(reply):
        return "flagged"
    if random.random() * 100 < _env_int("MONITOR_SAMPLE_PERCENT", 20, 0, 100):
        return "random"
    return ""


def note_pushback(db: Session, sub: Subscription, new_message: str) -> None:
    """If the owner's new message pushes back on the last answer, mark that
    task, and make sure it gets reviewed."""
    if not PUSHBACK.search(new_message):
        return
    last = db.scalar(
        select(AgentTask)
        .where(AgentTask.subscription_id == sub.id, AgentTask.succeeded.is_(True))
        .order_by(AgentTask.id.desc())
        .limit(1)
    )
    if last is None:
        return
    last.owner_pushback = True
    if last.review_status == "skipped":
        last.review_status = "pending"
        last.sample_reason = "pushback"


def log_task(
    db: Session,
    sub: Subscription,
    question: WorkspaceMessage,
    answer: WorkspaceMessage,
    latency_ms: int,
) -> AgentTask:
    """Records a finished task. The caller commits."""
    earlier = db.scalar(
        select(func.count(AgentTask.id)).where(
            AgentTask.subscription_id == sub.id, AgentTask.succeeded.is_(True)
        )
    )
    reason = sample_reason(int(earlier or 0), answer.content)
    task = AgentTask(
        subscription_id=sub.id,
        question_id=question.id,
        answer_id=answer.id,
        succeeded=True,
        latency_ms=latency_ms,
        review_status="pending" if reason else "skipped",
        sample_reason=reason,
    )
    db.add(task)
    return task


def log_failure(db: Session, sub: Subscription, latency_ms: int) -> None:
    """Records that the AI failed to answer. Commits straight away, because the
    request is about to end with an error."""
    db.add(AgentTask(subscription_id=sub.id, succeeded=False, latency_ms=latency_ms))
    db.commit()


# ---------- Reviewing ----------

REVIEWER_PROMPT = (
    "You are Selgo's agent reviewer. You check the work of AI agents that "
    "businesses pay for. Be strict and fair, and judge only the agent's answer "
    "in THE TASK, using everything you are given about the agent and the business.\n\n"
    "Return only a JSON object with exactly these keys and no other text:\n"
    '- "topic": what the task was about, in at most 8 words\n'
    '- "score": a whole number from 0 to 100 (90 and up excellent, 70-89 good, '
    "50-69 needs work, below 50 a problem)\n"
    '- "verdict": "good", "needs_work" or "problem"\n'
    '- "answered": true if the answer actually dealt with what the owner asked\n'
    '- "followed_instructions": true or false, or null if the owner gave no instructions\n'
    '- "used_knowledge": true if the answer is consistent with the knowledge provided, '
    "false if it contradicts or ignores it, null if no knowledge was provided\n"
    '- "minutes_saved": whole minutes a capable person would need to produce an '
    "answer this good (0 if the answer didn't help)\n"
    '- "feedback": one or two plain sentences for the business owner: what was good '
    "and what to improve\n\n"
    'Use "problem" for wrong facts, ignoring the owner\'s instructions, rude or '
    "harmful content, or not answering. Write topic and feedback in the language "
    "the owner used."
)

Verdict = Literal["good", "needs_work", "problem"]


class ReviewResult(BaseModel):
    topic: str = Field(default="", max_length=160)
    score: int = Field(ge=0, le=100)
    verdict: Optional[Verdict] = None
    answered: Optional[bool] = None
    followed_instructions: Optional[bool] = None
    used_knowledge: Optional[bool] = None
    minutes_saved: int = Field(default=0, ge=0, le=480)
    feedback: str = Field(default="", max_length=1000)

    @field_validator("verdict", mode="before")
    @classmethod
    def normalize_verdict(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip().lower().replace(" ", "_").replace("-", "_")
            return cleaned if cleaned in ("good", "needs_work", "problem") else None
        return value

    @field_validator("topic", "feedback", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        return value.strip()[:1000] if isinstance(value, str) else value

    @field_validator("minutes_saved", mode="before")
    @classmethod
    def clamp_minutes(cls, value: object) -> object:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return int(min(480, max(0, round(value))))
        return value

    def final_verdict(self) -> str:
        if self.verdict:
            return self.verdict
        return "good" if self.score >= 70 else "needs_work" if self.score >= 50 else "problem"


def parse_review(text: str) -> ReviewResult:
    """Reads the reviewer's JSON, even if the model wrapped it in thinking
    text or a code block. Raises ValueError if there is no usable review."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("The reviewer didn't return a JSON object.")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("The reviewer's JSON isn't an object.")
    try:
        return ReviewResult.model_validate(data)
    except ValidationError as error:
        raise ValueError(f"The reviewer's JSON is incomplete: {error}") from error


def _clip(text: str, limit: int) -> str:
    text = text.strip()
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."


def review_material(
    sub: Subscription,
    passages: List[str],
    earlier: List[WorkspaceMessage],
    question: str,
    answer: str,
) -> str:
    agent = sub.agent
    lines = [
        f"WHAT THE AGENT IS FOR: {agent.name}. {agent.tagline}. {_clip(agent.description, 600)}",
        f"THE AGENT'S RULES:\n{_clip(agent.system_prompt, 2500)}",
        f"WHAT THE OWNER TOLD IT ABOUT THEIR BUSINESS:\n{_clip(sub.business_context, 1500) or '(nothing)'}",
        f"THE OWNER'S INSTRUCTIONS:\n{_clip(sub.custom_instructions, 1500) or '(none)'}",
        "KNOWLEDGE THE AGENT HAD FOR THIS QUESTION:\n"
        + ("\n---\n".join(_clip(p, 800) for p in passages) if passages else "(none)"),
    ]
    if earlier:
        lines.append(
            "EARLIER IN THE CONVERSATION (oldest first):\n"
            + "\n".join(f"{'Owner' if m.role == 'user' else 'Agent'}: {_clip(m.content, 500)}" for m in earlier)
        )
    lines.append(f"THE TASK\nOwner: {_clip(question, 3000)}\nAgent: {_clip(answer, 4000)}")
    return "\n\n".join(lines)


def _ask_reviewer(material: str) -> Tuple[ReviewResult, str]:
    """Asks the reviewer model; falls back to the main model once if the
    reviewer is unavailable or answers in an unusable way."""
    models = [review_model()]
    if main_model() not in models:
        models.append(main_model())
    last_error: Exception = ValueError("No reviewer model is set.")
    for model in models:
        try:
            return parse_review(generate_reply(REVIEWER_PROMPT, [], material, model=model)), model
        except (AIError, ValueError) as error:
            last_error = error
            logger.warning("Tracker review with %s failed: %s", model, error)
    raise last_error


def claim(db: Session, task_id: int) -> bool:
    """Marks a task as being reviewed. Only one worker can win the claim, so a
    task is never reviewed twice at the same time."""
    stale = utcnow() - STALE_CLAIM
    result = db.execute(
        update(AgentTask)
        .where(
            AgentTask.id == task_id,
            or_(
                AgentTask.review_status == "pending",
                and_(AgentTask.review_status == "reviewing", AgentTask.claimed_at < stale),
            ),
        )
        .values(review_status="reviewing", claimed_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount == 1


def review_task(db: Session, task: AgentTask) -> None:
    """Reviews one claimed task and saves what the reviewer found."""
    sub = db.get(Subscription, task.subscription_id)
    question = db.get(WorkspaceMessage, task.question_id) if task.question_id else None
    answer = db.get(WorkspaceMessage, task.answer_id) if task.answer_id else None
    if sub is None or question is None or answer is None:
        task.review_status = "failed"
        task.reviewed_at = utcnow()
        db.commit()
        return

    earlier = list(
        db.scalars(
            select(WorkspaceMessage)
            .where(WorkspaceMessage.subscription_id == sub.id, WorkspaceMessage.id < question.id)
            .order_by(WorkspaceMessage.id.desc())
            .limit(4)
        ).all()
    )[::-1]
    material = review_material(
        sub, find_passages(db, sub.agent_id, question.content), earlier, question.content, answer.content
    )

    try:
        result, model = _ask_reviewer(material)
    except (AIError, ValueError):
        task.review_status = "failed"
        task.reviewed_at = utcnow()
        db.commit()
        return

    task.topic = result.topic[:160]
    task.score = result.score
    task.verdict = result.final_verdict()
    task.answered = result.answered
    task.followed_instructions = result.followed_instructions if sub.custom_instructions.strip() else None
    task.used_knowledge = result.used_knowledge
    task.minutes_saved = result.minutes_saved
    task.feedback = result.feedback
    task.reviewer_model = model
    task.review_status = "done"
    task.reviewed_at = utcnow()
    db.commit()


def process_pending(db: Session, subscription_id: Optional[int] = None, limit: int = 3) -> int:
    """Reviews up to `limit` waiting tasks (for one subscription, or all).
    Returns how many were reviewed."""
    query = select(AgentTask.id).where(AgentTask.review_status.in_(("pending", "reviewing")))
    if subscription_id is not None:
        query = query.where(AgentTask.subscription_id == subscription_id)
    candidates = db.scalars(query.order_by(AgentTask.id.asc()).limit(limit * 3)).all()
    done = 0
    for task_id in candidates:
        if done >= limit:
            break
        if not claim(db, task_id):
            continue  # someone else is reviewing it
        task = db.get(AgentTask, task_id)
        if task is not None:
            review_task(db, task)
            done += 1
    return done


def review_soon(task_id: int) -> None:
    """Reviews one task after the answer has been sent (a background task).
    If this is cut short, the task stays waiting and is reviewed later."""
    try:
        with SessionLocal() as db:
            if claim(db, task_id):
                task = db.get(AgentTask, task_id)
                if task is not None:
                    review_task(db, task)
    except Exception:  # noqa: BLE001
        logger.exception("Background review of task %s failed.", task_id)


# ---------- The owner's report ----------


def _percent(part: int, whole: int) -> Optional[int]:
    return round(100 * part / whole) if whole else None


def _week_start(moment: datetime) -> datetime:
    day = moment.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return day - timedelta(days=day.weekday())  # Monday


def build_report(db: Session, sub: Subscription) -> TrackerReport:
    since = utcnow() - timedelta(days=REPORT_DAYS)
    tasks = list(
        db.scalars(
            select(AgentTask)
            .where(AgentTask.subscription_id == sub.id, AgentTask.created_at >= since)
            .order_by(AgentTask.id.asc())
        ).all()
    )
    handled = [t for t in tasks if t.succeeded]
    reviewed = [t for t in handled if t.review_status == "done" and t.score is not None]
    with_rules = [t for t in reviewed if t.followed_instructions is not None]
    with_answer = [t for t in reviewed if t.answered is not None]
    minutes = [t.minutes_saved for t in reviewed if t.minutes_saved is not None]

    # Time saved: the reviewer's average estimate, applied to every task handled.
    hours_saved = round(mean(minutes) * len(handled) / 60, 1) if minutes else None

    weeks: List[TrackerWeek] = []
    this_week = _week_start(utcnow())
    for back in range(3, -1, -1):
        start = this_week - timedelta(weeks=back)
        end = start + timedelta(weeks=1)
        in_week = [t for t in handled if start <= t.created_at < end]
        scores = [t.score for t in in_week if t.review_status == "done" and t.score is not None]
        weeks.append(
            TrackerWeek(
                week_start=start,
                tasks=len(in_week),
                average_score=round(mean(scores)) if scores else None,
            )
        )

    flagged = [t for t in reviewed if t.verdict in ("problem", "needs_work")]
    flagged.sort(key=lambda t: (t.verdict != "problem", -t.id))
    messages: Dict[int, WorkspaceMessage] = {}
    ids = [i for t in flagged[:MAX_FINDINGS] for i in (t.question_id, t.answer_id) if i]
    if ids:
        for message in db.scalars(select(WorkspaceMessage).where(WorkspaceMessage.id.in_(ids))).all():
            messages[message.id] = message
    findings = [
        TrackerFinding(
            task_id=t.id,
            created_at=t.created_at,
            topic=t.topic,
            score=t.score,
            verdict=t.verdict,
            feedback=t.feedback,
            question=_clip(messages[t.question_id].content, 300) if t.question_id in messages else "",
            answer=_clip(messages[t.answer_id].content, 400) if t.answer_id in messages else "",
            owner_pushback=t.owner_pushback,
        )
        for t in flagged[:MAX_FINDINGS]
    ]

    latencies = [t.latency_ms for t in handled if t.latency_ms > 0]
    last_reviewed = max((t.reviewed_at for t in reviewed if t.reviewed_at), default=None)
    models_used = sorted({t.reviewer_model for t in reviewed if t.reviewer_model})

    return TrackerReport(
        period_days=REPORT_DAYS,
        tasks_handled=len(handled),
        failed=len(tasks) - len(handled),
        reviewed=len(reviewed),
        pending_reviews=sum(1 for t in handled if t.review_status in ("pending", "reviewing")),
        average_score=round(mean(t.score for t in reviewed if t.score is not None)) if reviewed else None,
        good=sum(1 for t in reviewed if t.verdict == "good"),
        needs_work=sum(1 for t in reviewed if t.verdict == "needs_work"),
        problem=sum(1 for t in reviewed if t.verdict == "problem"),
        answered_rate=_percent(sum(1 for t in with_answer if t.answered), len(with_answer)),
        instructions_rate=_percent(sum(1 for t in with_rules if t.followed_instructions), len(with_rules)),
        average_response_seconds=round(mean(latencies) / 1000, 1) if latencies else None,
        hours_saved=hours_saved,
        owner_pushbacks=sum(1 for t in handled if t.owner_pushback),
        weeks=weeks,
        findings=findings,
        reviewer=", ".join(models_used) or review_model(),
        last_reviewed_at=last_reviewed,
    )


# ---------- Scheduled run ----------


@router.post("/run")
def run_reviews(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, int]:
    """Reviews waiting tasks for every business. Meant for a scheduled job:
    send the CRON_SECRET from api/.env as "Authorization: Bearer <secret>"."""
    secret = os.getenv("CRON_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Set CRON_SECRET to use this."
        )
    if not hmac.compare_digest((authorization or "").encode("utf-8"), f"Bearer {secret}".encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed.")
    return {"reviewed": process_pending(db, None, limit=_env_int("MONITOR_RUN_LIMIT", 20, 1, 200))}
