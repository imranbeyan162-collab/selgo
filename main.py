from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import (
    AgentCommentModel,
    AgentModel,
    Base,
    DeveloperModel,
    PayoutRequestModel,
    RLTrajectoryModel,
    SessionLocal,
    SubscriptionModel,
    UserAccountModel,
    engine,
    get_db,
)
from mentor_brain import SelgoMentorBrain
from security import MallSecurityGuard, SecurityCheckResult
from worker_engine import SelgoWorkerEngine

app = FastAPI(
    title="Selgo — AI Agents • Automated for You",
    version="12.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_TTL_DAYS = 30
Base.metadata.create_all(bind=engine)


def log_rl_reward_event(
    db: Session,
    user_id: Optional[int],
    state_context: Dict[str, Any],
    action_type: str,
    target_agent_id: Optional[int],
    reward_score: float,
) -> None:
    try:
        traj = RLTrajectoryModel(
            user_id=user_id,
            state_context_json=json.dumps(state_context, ensure_ascii=False),
            action_type=action_type,
            target_agent_id=target_agent_id,
            reward_score=reward_score,
        )
        db.add(traj)
        db.commit()
    except Exception:
        db.rollback()


def hash_password(password: str) -> str:
    salt = "selgo_security_salt_v1"
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()


def validate_strong_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Strong password required: Use at least 8 characters including a letter and a number.",
        )
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=400,
            detail="Strong password required: Include both letters (A-Z) and numbers (0-9).",
        )


def dispatch_selgo_email(to_email: str, subject: str, body_text: str) -> Dict[str, str]:
    smtp_user = (os.getenv("SMTP_EMAIL") or "").strip()
    smtp_pass = (os.getenv("SMTP_PASSWORD") or "").strip()

    delivery_mode = "Selgo Instant In-App Mail"
    if smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = to_email
            msg.set_content(body_text)
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=8) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            delivery_mode = "Delivered via SMTP"
        except Exception:
            delivery_mode = "Selgo Instant Mail Preview"

    return {
        "to": to_email,
        "subject": subject,
        "body": body_text,
        "delivery": delivery_mode,
    }


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> UserAccountModel:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please log in to your Selgo account.")
    token = authorization.replace("Bearer ", "").strip()
    user = db.query(UserAccountModel).filter(UserAccountModel.session_token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Session not found. Please log in.")

    now = datetime.now(timezone.utc)
    if user.session_expires_at:
        exp = user.session_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now > exp:
            raise HTTPException(
                status_code=401,
                detail="You haven't logged in for over 30 days. Please log in again for security.",
            )

    user.session_expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    user.last_login_at = now
    db.commit()
    return user


class SignUpRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    recovery_code: str
    new_password: str


class SaveOnboardingRequest(BaseModel):
    role_key: str = ""
    role_label: str = ""
    need_label: str = ""
    context_label: str = ""


class DeveloperProfileSetupRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=60)
    display_name: str = Field(..., min_length=1, max_length=120)
    avatar_url: str
    headline: str = Field(..., min_length=1, max_length=160)
    bio: str = Field(..., min_length=1)
    skills: str = Field(..., min_length=1)


class DeployAgentUnderAccountRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    industry: str = Field(..., min_length=1, max_length=80)
    tagline: str = Field(..., min_length=1, max_length=220)
    description: str = Field(..., min_length=1)
    system_prompt: str = Field(
        default="You are a specialized autonomous AI agent helping this business scale."
    )
    input_label: str = Field(default="Talk to your agent or assign a task...")
    monthly_price_usd: int = Field(default=49, ge=1, le=100000)
    python_code: str = Field(..., min_length=10)


class AgentReactionRequest(BaseModel):
    reaction_type: str = Field(default="like")


class AgentCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=600)


class CreatorPayoutRequest(BaseModel):
    payout_method: str = Field(..., min_length=2, max_length=80)
    destination_account: str = Field(..., min_length=3, max_length=160)


class AgentPreviewSandboxRequest(BaseModel):
    agent_id: int
    sample_prompt: str = Field(..., min_length=1, max_length=500)


class SmartInterviewRequest(BaseModel):
    user_message: str
    memory: Dict[str, Optional[str]] = Field(
        default_factory=lambda: {"owner_name": None, "industry": None, "pain_point": None}
    )
    history: List[Dict[str, str]] = Field(default_factory=list)
    voice_mode: bool = False


class SubscribeAndDeployRequest(BaseModel):
    business_name: str = Field(..., min_length=1)
    business_goal: str = Field(..., min_length=1)
    payment_method: str = Field(default="Card")
    agent_id: int


class UpdateKnowledgeBaseRequest(BaseModel):
    subscription_id: int
    knowledge_base_text: str


class WorkspaceAgentChatRequest(BaseModel):
    subscription_id: int
    message: str = Field(..., min_length=1)
    voice_mode: bool = False


def parse_user_onboarding(user: UserAccountModel) -> Optional[Dict[str, Any]]:
    if not user.onboarding_json:
        return None
    try:
        data = json.loads(user.onboarding_json)
        if isinstance(data, dict) and data.get("completed"):
            return data
    except Exception:
        pass
    return None


def format_dev_profile(dev: Optional[DeveloperModel], db: Session) -> Optional[Dict[str, Any]]:
    if not dev:
        return None
    my_agents = (
        db.query(AgentModel)
        .filter(AgentModel.developer_id == dev.id, AgentModel.status == "PUBLISHED")
        .order_by(AgentModel.id.desc())
        .all()
    )
    agent_ids = [a.id for a in my_agents]
    recent_subs: List[Dict[str, Any]] = []
    gross_sales_cents = 0
    selgo_fee_cents = 0

    if agent_ids:
        all_subs = (
            db.query(SubscriptionModel)
            .filter(SubscriptionModel.agent_id.in_(agent_ids))
            .order_by(SubscriptionModel.id.desc())
            .all()
        )
        ag_name_map = {a.id: a.name for a in my_agents}
        for s in all_subs:
            gross_sales_cents += s.price_paid_cents
            selgo_fee_cents += s.selgo_commission_cents

        for s in all_subs[:10]:
            recent_subs.append({
                "business_name": s.business_name,
                "agent_name": ag_name_map.get(s.agent_id, "Agent"),
                "payment_method": s.payment_method,
                "invoice_code": s.invoice_code,
                "creator_earned_usd": round(s.developer_payout_cents / 100.0, 2),
                "tasks_completed": s.tasks_completed,
            })

    payouts = (
        db.query(PayoutRequestModel)
        .filter(PayoutRequestModel.developer_id == dev.id)
        .order_by(PayoutRequestModel.id.desc())
        .limit(8)
        .all()
    )

    available_cents = max(0, dev.earnings_cents - (dev.withdrawn_cents or 0))

    return {
        "developer_id": dev.id,
        "username": dev.username,
        "display_name": dev.display_name,
        "avatar_url": dev.avatar_url,
        "headline": dev.headline,
        "bio": dev.bio,
        "skills": [s.strip() for s in dev.skills.split(",") if s.strip()],
        "trust_score": dev.trust_score,
        "gross_sales_usd": round(gross_sales_cents / 100.0, 2),
        "selgo_fee_usd": round(selgo_fee_cents / 100.0, 2),
        "earnings_usd": round(dev.earnings_cents / 100.0, 2),
        "withdrawn_usd": round((dev.withdrawn_cents or 0) / 100.0, 2),
        "available_balance_usd": round(available_cents / 100.0, 2),
        "recent_subscribers": recent_subs,
        "payout_history": [
            {
                "amount_usd": round(p.amount_cents / 100.0, 2),
                "payout_method": p.payout_method,
                "destination": p.Destination_account,
                "reference_code": p.reference_code,
                "status": p.status,
            }
            for p in payouts
        ],
        "agents": [
            {
                "agent_id": a.id,
                "name": a.name,
                "industry": a.industry,
                "tagline": a.tagline,
                "description": a.description,
                "monthly_price_usd": int(a.monthly_price_cents / 100),
                "active_subscribers": a.active_subscribers,
                "likes_count": a.likes_count,
                "fire_count": a.fire_count,
                "rocket_count": a.rocket_count,
                "comments_count": a.comments_count,
            }
            for a in my_agents
        ],
    }


def format_user_subscriptions(user_id: int, db: Session) -> List[Dict[str, Any]]:
    subs = (
        db.query(SubscriptionModel)
        .filter(SubscriptionModel.user_id == user_id)
        .order_by(SubscriptionModel.id.desc())
        .all()
    )
    result = []
    for s in subs:
        ag = db.query(AgentModel).filter(AgentModel.id == s.agent_id).first()
        if not ag:
            continue
        dev = db.query(DeveloperModel).filter(DeveloperModel.id == ag.developer_id).first()
        try:
            chat_history = json.loads(s.chat_history_json or "[]")
        except Exception:
            chat_history = []
        result.append({
            "subscription_id": s.id,
            "business_name": s.business_name,
            "business_goal": s.business_goal,
            "knowledge_base_text": s.knowledge_base_text or "",
            "payment_method": s.payment_method,
            "invoice_code": s.invoice_code,
            "status": s.status,
            "agent_id": ag.id,
            "agent_name": ag.name,
            "agent_industry": ag.industry,
            "developer_name": dev.display_name if dev else "Verified Creator",
            "developer_username": dev.username if dev else "creator",
            "developer_avatar": dev.avatar_url if dev else "",
            "monthly_total_usd": round(s.price_paid_cents / 100.0, 2),
            "tasks_completed": s.tasks_completed,
            "minutes_saved": s.minutes_saved,
            "value_created_usd": s.tasks_completed * 25,
            "chat_history": chat_history,
        })
    return result


@app.post("/api/v1/auth/signup")
async def signup_account(req: SignUpRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    clean_email = req.email.strip().lower()
    existing = db.query(UserAccountModel).filter(UserAccountModel.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists. Switching you to Log In.",
        )

    validate_strong_password(req.password)

    now = datetime.now(timezone.utc)
    token = secrets.token_hex(32)
    user = UserAccountModel(
        email=clean_email,
        full_name=req.full_name.strip(),
        password_hash=hash_password(req.password),
        session_token=token,
        session_expires_at=now + timedelta(days=SESSION_TTL_DAYS),
        last_login_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    email_notice = dispatch_selgo_email(
        to_email=clean_email,
        subject="Welcome to Selgo — Your Account is Connected",
        body_text=(
            f"Hi {user.full_name},\n\n"
            f"Your Selgo account ({clean_email}) is now verified and connected. "
            "Your 30-day persistent session is active, and you can recover your password anytime via this email."
        ),
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "onboarding": None,
        },
        "developer_profile": None,
        "subscriptions": [],
        "email_notification": email_notice,
    }


@app.post("/api/v1/auth/login")
async def login_account(req: LoginRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    clean_email = req.email.strip().lower()
    user = db.query(UserAccountModel).filter(UserAccountModel.email == clean_email).first()
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    now = datetime.now(timezone.utc)
    token = secrets.token_hex(32)
    user.session_token = token
    user.session_expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    user.last_login_at = now
    db.commit()

    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    email_notice = dispatch_selgo_email(
        to_email=clean_email,
        subject="Selgo Security Notice — New Sign-In",
        body_text=f"Hi {user.full_name}, your Selgo account was just signed in. Your session will stay active for 30 days.",
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "onboarding": parse_user_onboarding(user),
        },
        "developer_profile": format_dev_profile(dev, db),
        "subscriptions": format_user_subscriptions(user.id, db),
        "email_notification": email_notice,
    }


@app.post("/api/v1/auth/onboarding")
async def save_permanent_onboarding(
    req: SaveOnboardingRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    payload = {
        "completed": True,
        "role_key": req.role_key.strip(),
        "role_label": req.role_label.strip(),
        "need_label": req.need_label.strip(),
        "context_label": req.context_label.strip(),
    }
    user.onboarding_json = json.dumps(payload)
    db.commit()

    log_rl_reward_event(
        db=db,
        user_id=user.id,
        state_context=payload,
        action_type="ONBOARDING_ROUTE_COMPLETED",
        target_agent_id=None,
        reward_score=1.0,
    )
    return {"onboarding": payload}


@app.post("/api/v1/auth/forgot-password")
async def request_password_recovery(req: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    clean_email = req.email.strip().lower()
    user = db.query(UserAccountModel).filter(UserAccountModel.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No Selgo account found with that email address.")

    code = str(secrets.randbelow(900000) + 100000)
    user.reset_code = code
    user.reset_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    db.commit()

    email_notice = dispatch_selgo_email(
        to_email=clean_email,
        subject=f"Selgo Password Recovery Code: {code}",
        body_text=(
            f"Hi {user.full_name},\n\n"
            f"Your 6-digit Selgo password recovery code is: {code}\n"
            "Enter this code on the recovery screen to set a new strong password."
        ),
    )

    return {
        "message": f"Recovery code sent to {clean_email}.",
        "email_notification": email_notice,
    }


@app.post("/api/v1/auth/reset-password")
async def reset_password_with_code(req: ResetPasswordRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    clean_email = req.email.strip().lower()
    user = db.query(UserAccountModel).filter(UserAccountModel.email == clean_email).first()
    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Invalid recovery request.")

    if user.reset_code.strip() != req.recovery_code.strip():
        raise HTTPException(status_code=400, detail="Incorrect 6-digit recovery code.")

    validate_strong_password(req.new_password)

    now = datetime.now(timezone.utc)
    token = secrets.token_hex(32)
    user.password_hash = hash_password(req.new_password)
    user.reset_code = None
    user.reset_code_expires_at = None
    user.session_token = token
    user.session_expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    db.commit()

    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    email_notice = dispatch_selgo_email(
        to_email=clean_email,
        subject="Selgo Password Updated Successfully",
        body_text=f"Hi {user.full_name}, your Selgo password has been reset and your account is now logged in.",
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "onboarding": parse_user_onboarding(user),
        },
        "developer_profile": format_dev_profile(dev, db),
        "subscriptions": format_user_subscriptions(user.id, db),
        "email_notification": email_notice,
    }


@app.get("/api/v1/auth/me")
async def get_my_session(
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "onboarding": parse_user_onboarding(user),
        },
        "developer_profile": format_dev_profile(dev, db),
        "subscriptions": format_user_subscriptions(user.id, db),
    }


@app.post("/api/v1/developers/profile")
async def save_my_developer_profile(
    req: DeveloperProfileSetupRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    clean_handle = req.username.strip().lower().replace(" ", "_")
    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()

    handle_owner = db.query(DeveloperModel).filter(DeveloperModel.username == clean_handle).first()
    if handle_owner and (not dev or handle_owner.id != dev.id):
        raise HTTPException(status_code=400, detail="That @username is already taken.")

    if dev:
        dev.username = clean_handle
        dev.display_name = req.display_name.strip()
        dev.avatar_url = req.avatar_url
        dev.headline = req.headline.strip()
        dev.bio = req.bio.strip()
        dev.skills = req.skills.strip()
    else:
        dev = DeveloperModel(
            user_id=user.id,
            username=clean_handle,
            display_name=req.display_name.strip(),
            avatar_url=req.avatar_url,
            headline=req.headline.strip(),
            bio=req.bio.strip(),
            skills=req.skills.strip(),
            trust_score=100,
        )
        db.add(dev)

    db.commit()
    db.refresh(dev)
    return format_dev_profile(dev, db)  # type: ignore


@app.post("/api/v1/developers/payout")
async def request_creator_payout(
    req: CreatorPayoutRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    if not dev:
        raise HTTPException(status_code=400, detail="Creator profile not found.")

    available_cents = max(0, dev.earnings_cents - (dev.withdrawn_cents or 0))
    if available_cents <= 0:
        raise HTTPException(status_code=400, detail="No available payout balance to withdraw yet.")

    ref_code = "PAY-" + secrets.token_hex(3).upper()
    payout = PayoutRequestModel(
        developer_id=dev.id,
        amount_cents=available_cents,
        payout_method=req.payout_method.strip(),
        Destination_account=req.destination_account.strip(),
        status="PROCESSED",
        reference_code=ref_code,
    )
    db.add(payout)
    dev.withdrawn_cents = (dev.withdrawn_cents or 0) + available_cents
    db.commit()
    db.refresh(dev)

    email_notice = dispatch_selgo_email(
        to_email=user.email,
        subject=f"Selgo Creator Payout Dispatched ({ref_code})",
        body_text=(
            f"Hi {dev.display_name},\n\n"
            f"Your 75% creator revenue payout of ${available_cents / 100.0:.2f} USD has been sent via "
            f"{req.payout_method} to {req.destination_account}.\nReference: {ref_code}"
        ),
    )

    return {
        "developer_profile": format_dev_profile(dev, db),
        "email_notification": email_notice,
    }


@app.delete("/api/v1/agents/{agent_id}")
async def delete_my_agent(
    agent_id: int,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    if not dev:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    agent = db.query(AgentModel).filter(AgentModel.id == agent_id, AgentModel.developer_id == dev.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found under your profile.")

    agent.status = "ARCHIVED"
    db.commit()
    return {"developer_profile": format_dev_profile(dev, db)}


@app.get("/api/v1/developers/public/{username}")
async def get_public_developer_profile(username: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    dev = db.query(DeveloperModel).filter(DeveloperModel.username == username.strip().lower()).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Creator profile not found.")
    return format_dev_profile(dev, db)  # type: ignore


@app.post("/api/v1/agents/deploy")
async def post_agent_under_my_account(
    req: DeployAgentUnderAccountRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    dev = db.query(DeveloperModel).filter(DeveloperModel.user_id == user.id).first()
    if not dev:
        raise HTTPException(status_code=400, detail="Complete your one-time Creator Profile first.")
    if dev.is_suspended:
        raise HTTPException(status_code=403, detail="Your creator account is suspended.")

    security_scan: SecurityCheckResult = MallSecurityGuard.check_developer_code(req.python_code)
    if not security_scan.is_safe:
        raise HTTPException(status_code=400, detail={"reasons": security_scan.reasons})

    desc_scan = MallSecurityGuard.check_message_for_leaks(
        {"tagline": req.tagline, "description": req.description, "system_prompt": req.system_prompt}
    )
    if not desc_scan.is_safe:
        raise HTTPException(status_code=400, detail={"reasons": desc_scan.reasons})

    agent = AgentModel(
        developer_id=dev.id,
        name=req.name.strip(),
        industry=req.industry.strip(),
        tagline=req.tagline.strip(),
        description=req.description.strip(),
        system_prompt=req.system_prompt.strip(),
        input_label=req.input_label.strip(),
        monthly_price_cents=req.monthly_price_usd * 100,
        selgo_fee_percent=25,
        python_code=req.python_code,
        sha256_fingerprint=security_scan.sha256_fingerprint or "",
        status="PUBLISHED",
        active_subscribers=0,
        likes_count=1,
        fire_count=1,
        rocket_count=1,
        comments_count=0,
        liked_by_users_json=json.dumps([user.id]),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    return {
        "agent_id": agent.id,
        "name": agent.name,
        "developer_profile": format_dev_profile(dev, db),
    }


@app.post("/api/v1/agents/{agent_id}/react")
async def react_to_marketplace_agent(
    agent_id: int,
    req: AgentReactionRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    try:
        liked_users = json.loads(agent.liked_by_users_json or "[]")
    except Exception:
        liked_users = []

    rtype = req.reaction_type.lower().strip()
    if rtype == "like":
        if user.id in liked_users:
            liked_users.remove(user.id)
            agent.likes_count = max(0, agent.likes_count - 1)
            user_liked = False
        else:
            liked_users.append(user.id)
            agent.likes_count += 1
            user_liked = True
        agent.liked_by_users_json = json.dumps(liked_users)
    elif rtype == "fire":
        agent.fire_count += 1
        user_liked = user.id in liked_users
    elif rtype == "rocket":
        agent.rocket_count += 1
        user_liked = user.id in liked_users
    else:
        user_liked = user.id in liked_users

    db.commit()
    db.refresh(agent)

    log_rl_reward_event(
        db=db,
        user_id=user.id,
        state_context=parse_user_onboarding(user) or {},
        action_type=f"SOCIAL_REACTION_{rtype.upper()}",
        target_agent_id=agent.id,
        reward_score=1.5,
    )

    return {
        "agent_id": agent.id,
        "likes_count": agent.likes_count,
        "fire_count": agent.fire_count,
        "rocket_count": agent.rocket_count,
        "user_liked": user_liked,
    }


@app.get("/api/v1/agents/{agent_id}/comments")
async def get_agent_comments(agent_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    comments = (
        db.query(AgentCommentModel)
        .filter(AgentCommentModel.agent_id == agent_id)
        .order_by(AgentCommentModel.id.desc())
        .limit(40)
        .all()
    )
    return {
        "comments": [
            {
                "id": c.id,
                "author_name": c.author_name,
                "is_verified_subscriber": c.is_verified_subscriber,
                "content": c.content,
            }
            for c in comments
        ]
    }


@app.post("/api/v1/agents/{agent_id}/comments")
async def post_agent_comment(
    agent_id: int,
    req: AgentCommentRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    leak_scan = MallSecurityGuard.check_message_for_leaks({"comment": req.content})
    if not leak_scan.is_safe:
        raise HTTPException(status_code=400, detail="Off-platform contact links are not allowed in comments.")

    has_sub = (
        db.query(SubscriptionModel)
        .filter(SubscriptionModel.user_id == user.id, SubscriptionModel.agent_id == agent_id)
        .first()
        is not None
    )

    comment = AgentCommentModel(
        agent_id=agent_id,
        user_id=user.id,
        author_name=user.full_name,
        is_verified_subscriber=has_sub,
        content=req.content.strip(),
    )
    db.add(comment)
    agent.comments_count = (agent.comments_count or 0) + 1
    db.commit()

    return await get_agent_comments(agent_id, db)


@app.post("/api/v1/agents/preview-sandbox")
async def preview_agent_in_sandbox(
    req: AgentPreviewSandboxRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    agent = db.query(AgentModel).filter(AgentModel.id == req.agent_id).first()
    if not agent or agent.status != "PUBLISHED":
        raise HTTPException(status_code=404, detail="Agent not available.")

    result = SelgoWorkerEngine.run_agent_conversation_or_task(
        python_code=agent.python_code,
        expected_sha256=agent.sha256_fingerprint,
        agent_name=agent.name,
        agent_industry=agent.industry,
        agent_description=agent.description,
        agent_system_prompt=agent.system_prompt,
        business_name=f"{user.full_name} (Live Sandbox Preview)",
        business_goal="Evaluating agent capabilities before subscribing",
        user_message=req.sample_prompt,
        chat_history=[],
        agent_memory={},
        voice_mode=False,
    )

    if result["status"] != "SUCCESS":
        raise HTTPException(status_code=400, detail=result.get("reason") or "Preview failed.")

    log_rl_reward_event(
        db=db,
        user_id=user.id,
        state_context=parse_user_onboarding(user) or {},
        action_type="SANDBOX_PREVIEW_TEST",
        target_agent_id=agent.id,
        reward_score=2.5,
    )

    return {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "execution_speed_ms": result["duration_ms"],
        "agent_reply": result["agent_reply"],
        "structured_output": result["structured_output"],
    }


@app.get("/api/v1/marketplace/agents")
async def list_marketplace_agents(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    current_uid = None
    if authorization and authorization.startswith("Bearer "):
        tok = authorization.replace("Bearer ", "").strip()
        u = db.query(UserAccountModel).filter(UserAccountModel.session_token == tok).first()
        if u:
            current_uid = u.id

    devs = {d.id: d for d in db.query(DeveloperModel).all()}
    agents = (
        db.query(AgentModel)
        .filter(AgentModel.status == "PUBLISHED")
        .order_by(AgentModel.likes_count.desc(), AgentModel.id.desc())
        .all()
    )

    cards = []
    for ag in agents:
        creator = devs.get(ag.developer_id)
        try:
            liked_users = json.loads(ag.liked_by_users_json or "[]")
        except Exception:
            liked_users = []

        cards.append({
            "agent_id": ag.id,
            "name": ag.name,
            "industry": ag.industry,
            "tagline": ag.tagline,
            "description": ag.description,
            "input_label": ag.input_label,
            "monthly_price_usd": int(ag.monthly_price_cents / 100),
            "active_subscribers": ag.active_subscribers,
            "likes_count": ag.likes_count,
            "fire_count": ag.fire_count,
            "rocket_count": ag.rocket_count,
            "comments_count": ag.comments_count or 0,
            "user_liked": (current_uid in liked_users) if current_uid else False,
            "developer": {
                "username": creator.username if creator else "creator",
                "display_name": creator.display_name if creator else "Verified Creator",
                "avatar_url": creator.avatar_url if creator else "",
                "headline": creator.headline if creator else "",
                "bio": creator.bio if creator else "",
                "skills": [s.strip() for s in creator.skills.split(",") if s.strip()] if creator else [],
                "trust_score": creator.trust_score if creator else 100,
            },
        })
    return {"agents": cards}


@app.post("/api/v1/mentor/interview")
async def conduct_diagnostic_interview(
    req: SmartInterviewRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    published_agents = db.query(AgentModel).filter(AgentModel.status == "PUBLISHED").all()
    catalog_for_llm = [
        {
            "agent_id": a.id,
            "name": a.name,
            "industry": a.industry,
            "tagline": a.tagline,
            "description": a.description,
            "monthly_price_usd": int(a.monthly_price_cents / 100),
        }
        for a in published_agents
    ]

    user_msg = req.user_message
    if req.voice_mode:
        user_msg = (
            "[LIVE VOICE CALL TURN - Automatically detect the language of this message and reply in that exact "
            f"same language in 2-3 concise spoken sentences with no markdown symbols]: {req.user_message}"
        )

    brain_result = await SelgoMentorBrain.analyze_conversation(
        user_message=user_msg,
        memory=dict(req.memory),
        history=req.history,
        available_developer_agents=catalog_for_llm,
    )

    return {
        "memory": brain_result["memory"],
        "can_show_marketplace_button": brain_result["can_show_marketplace_button"],
        "recommended_agent_ids": brain_result["recommended_agent_ids"],
        "ai_reply": brain_result["ai_reply"],
    }


@app.post("/api/v1/subscriptions/subscribe")
async def subscribe_and_deploy_to_business(
    req: SubscribeAndDeployRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    agent = db.query(AgentModel).filter(AgentModel.id == req.agent_id).first()
    if not agent or agent.status != "PUBLISHED":
        raise HTTPException(status_code=404, detail="Agent not found or unavailable.")

    dev = db.query(DeveloperModel).filter(DeveloperModel.id == agent.developer_id).first()

    total_cents = agent.monthly_price_cents
    selgo_cut_cents = (total_cents * agent.selgo_fee_percent) // 100
    dev_payout_cents = total_cents - selgo_cut_cents
    invoice_code = "SLG-" + secrets.token_hex(3).upper()

    welcome_msg = (
        f"Hello! I am {agent.name}, now deployed and active for {req.business_name.strip()} (Invoice {invoice_code}). "
        f"My focus is set to: \"{req.business_goal.strip()}\". "
        "You can also upload your company data or price list on the right panel so I can reference your exact numbers. What should we tackle first?"
    )
    initial_history = [{"role": "assistant", "content": welcome_msg}]

    sub = SubscriptionModel(
        user_id=user.id,
        business_name=req.business_name.strip(),
        business_goal=req.business_goal.strip(),
        knowledge_base_text="",
        is_deployed=True,
        agent_id=agent.id,
        status="ACTIVE",
        payment_method=req.payment_method.strip(),
        invoice_code=invoice_code,
        price_paid_cents=total_cents,
        selgo_commission_cents=selgo_cut_cents,
        developer_payout_cents=dev_payout_cents,
        tasks_completed=0,
        minutes_saved=0,
        chat_history_json=json.dumps(initial_history),
        agent_memory_json="{}",
    )
    db.add(sub)
    agent.active_subscribers += 1
    if dev:
        dev.earnings_cents += dev_payout_cents

    db.commit()
    db.refresh(sub)

    log_rl_reward_event(
        db=db,
        user_id=user.id,
        state_context={
            "onboarding": parse_user_onboarding(user),
            "business_goal": sub.business_goal,
            "payment_method": sub.payment_method,
        },
        action_type="PAID_SUBSCRIPTION_CONVERSION",
        target_agent_id=agent.id,
        reward_score=10.0,
    )

    email_notice = dispatch_selgo_email(
        to_email=user.email,
        subject=f"Selgo Payment Receipt {invoice_code} — {agent.name}",
        body_text=(
            f"Organization: {sub.business_name}\n"
            f"Agent Deployed: {agent.name}\n"
            f"Payment Method: {sub.payment_method}\n"
            f"Amount Paid: ${total_cents / 100.0:.2f}/month\n"
            f"Split: ${dev_payout_cents / 100.0:.2f} Creator (75%) | ${selgo_cut_cents / 100.0:.2f} Selgo Cloud (25%)"
        ),
    )

    return {
        "subscription": {
            "subscription_id": sub.id,
            "business_name": sub.business_name,
            "business_goal": sub.business_goal,
            "knowledge_base_text": "",
            "payment_method": sub.payment_method,
            "invoice_code": sub.invoice_code,
            "status": sub.status,
            "agent_id": agent.id,
            "agent_name": agent.name,
            "agent_industry": agent.industry,
            "developer_name": dev.display_name if dev else "Verified Creator",
            "developer_username": dev.username if dev else "creator",
            "developer_avatar": dev.avatar_url if dev else "",
            "monthly_total_usd": total_cents / 100.0,
            "tasks_completed": 0,
            "minutes_saved": 0,
            "value_created_usd": 0,
            "chat_history": initial_history,
        },
        "all_subscriptions": format_user_subscriptions(user.id, db),
        "email_notification": email_notice,
    }


@app.post("/api/v1/workspace/knowledge")
async def sync_business_knowledge_base(
    req: UpdateKnowledgeBaseRequest,
    user: UserAccountModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    sub = (
        db.query(SubscriptionModel)
        .filter(SubscriptionModel.id == req.subscription_id, SubscriptionModel.user_id == user.id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    sub.knowledge_base_text = req.knowledge_base_text.strip()
    db.commit()
    return {
        "subscription_id": sub.id,
        "knowledge_base_text": sub.knowledge_base_text,
        "char_count": len(sub.knowledge_base_text),
    }


@app.post("/api/v1/workspace/chat")
async def chat_with_deployed_agent(
    req: WorkspaceAgentChatRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    sub = db.query(SubscriptionModel).filter(SubscriptionModel.id == req.subscription_id).first()
    if not sub or not sub.is_deployed:
        raise HTTPException(status_code=404, detail="Active subscription not found.")

    if sub.status == "PAUSED_BY_SECURITY":
        raise HTTPException(status_code=403, detail=sub.security_alert_message)

    agent = db.query(AgentModel).filter(AgentModel.id == sub.agent_id).first()
    if not agent or agent.status == "SUSPENDED_SECURITY":
        raise HTTPException(status_code=403, detail="Agent suspended by Selgo Security Guard.")

    try:
        chat_history = json.loads(sub.chat_history_json or "[]")
    except Exception:
        chat_history = []

    try:
        agent_memory = json.loads(sub.agent_memory_json or "{}")
    except Exception:
        agent_memory = {}

    multilingual_prompt = (
        f"{agent.system_prompt}\n"
        "IMPORTANT: Automatically detect the language the user is writing or speaking in "
        "(e.g., English, Amharic, Afaan Oromo, Arabic, French, etc.) and always reply fluently in that exact same language."
    )

    result = SelgoWorkerEngine.run_agent_conversation_or_task(
        python_code=agent.python_code,
        expected_sha256=agent.sha256_fingerprint,
        agent_name=agent.name,
        agent_industry=agent.industry,
        agent_description=agent.description,
        agent_system_prompt=multilingual_prompt,
        business_name=sub.business_name,
        business_goal=sub.business_goal,
        knowledge_base=sub.knowledge_base_text or "",
        user_message=req.message,
        chat_history=chat_history,
        agent_memory=agent_memory,
        voice_mode=req.voice_mode,
    )

    if result["status"] == "SECURITY_CUTOFF":
        agent.status = "SUSPENDED_SECURITY"
        sub.status = "PAUSED_BY_SECURITY"
        sub.security_alert_message = (
            f"SECURITY ALERT: Selgo intercepted unauthorized behavior ({result['reason']}). "
            "The developer's agent has been cut off and your subscription billing is paused."
        )
        dev = db.query(DeveloperModel).filter(DeveloperModel.id == agent.developer_id).first()
        if dev:
            dev.trust_score = 0
            dev.is_suspended = True
        db.commit()
        raise HTTPException(status_code=403, detail=sub.security_alert_message)

    if result["status"] != "SUCCESS":
        raise HTTPException(status_code=400, detail=result["reason"])

    chat_history.append({"role": "user", "content": req.message})
    chat_history.append({"role": "assistant", "content": result["agent_reply"]})

    sub.chat_history_json = json.dumps(chat_history[-40:])
    sub.agent_memory_json = json.dumps(result["updated_memory"])
    sub.tasks_completed += 1
    sub.minutes_saved += 15
    db.commit()
    db.refresh(sub)

    return {
        "status": "SUCCESS",
        "execution_speed_ms": result["duration_ms"],
        "agent_reply": result["agent_reply"],
        "structured_output": result["structured_output"],
        "chat_history": chat_history[-40:],
        "metrics": {
            "tasks_completed": sub.tasks_completed,
            "minutes_saved": sub.minutes_saved,
            "value_created_usd": sub.tasks_completed * 25,
        },
    }


@app.get("/api/v1/rl/dataset")
async def export_rl_training_trajectories(db: Session = Depends(get_db)) -> Dict[str, Any]:
    rows = (
        db.query(RLTrajectoryModel)
        .order_by(RLTrajectoryModel.id.desc())
        .limit(200)
        .all()
    )

    trajectories = []
    for r in rows:
        try:
            state_obj = json.loads(r.state_context_json or "{}")
        except Exception:
            state_obj = {}
        trajectories.append({
            "trajectory_id": r.id,
            "user_id": r.user_id,
            "state": state_obj,
            "action": r.action_type,
            "target_agent_id": r.target_agent_id,
            "reward": r.reward_score,
            "timestamp": str(r.created_at),
        })

    return {
        "total_trajectories": len(trajectories),
        "trajectories": trajectories,
    }


@app.get("/", response_class=HTMLResponse)
@app.get("/app", response_class=HTMLResponse)
async def serve_selgo_web_app() -> str:
    html_file = Path(__file__).parent / "index.html"
    if html_file.exists():
        return html_file.read_text(encoding="utf-8")
    return "<h1>Selgo Cloud API is Online</h1>"