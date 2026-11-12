from datetime import datetime, timezone
import os
from typing import Generator
from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./selgo.db").strip()
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = raw_db_url
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserAccountModel(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)
    session_token = Column(String(128), unique=True, nullable=True, index=True)
    session_expires_at = Column(DateTime, nullable=True)
    reset_code = Column(String(20), nullable=True)
    reset_code_expires_at = Column(DateTime, nullable=True)
    onboarding_json = Column(Text, nullable=True)
    last_login_at = Column(DateTime, default=utc_now, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class DeveloperModel(Base):
    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True)
    username = Column(String(60), unique=True, nullable=False, index=True)
    display_name = Column(String(120), nullable=False)
    avatar_url = Column(Text, nullable=False)
    headline = Column(String(160), nullable=False)
    bio = Column(Text, nullable=False)
    skills = Column(String(250), nullable=False)
    trust_score = Column(Integer, default=100, nullable=False)
    is_suspended = Column(Boolean, default=False, nullable=False)
    earnings_cents = Column(Integer, default=0, nullable=False)
    withdrawn_cents = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    industry = Column(String(80), nullable=False, index=True)
    tagline = Column(String(220), nullable=False)
    description = Column(Text, nullable=False)
    system_prompt = Column(
        Text,
        default="You are a specialized autonomous business AI agent running inside Selgo Cloud.",
        nullable=False,
    )
    input_label = Column(String(120), default="Talk to your agent or assign a task...", nullable=False)
    monthly_price_cents = Column(Integer, nullable=False)
    selgo_fee_percent = Column(Integer, default=25, nullable=False)
    python_code = Column(Text, nullable=False)
    sha256_fingerprint = Column(String(64), nullable=False)
    status = Column(String(30), default="PUBLISHED", nullable=False)
    active_subscribers = Column(Integer, default=0, nullable=False)
    likes_count = Column(Integer, default=0, nullable=False)
    fire_count = Column(Integer, default=0, nullable=False)
    rocket_count = Column(Integer, default=0, nullable=False)
    comments_count = Column(Integer, default=0, nullable=False)
    liked_by_users_json = Column(Text, default="[]", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    business_name = Column(String(150), nullable=False)
    business_goal = Column(Text, nullable=False)
    knowledge_base_text = Column(Text, default="", nullable=False)
    is_deployed = Column(Boolean, default=False, nullable=False)
    agent_id = Column(Integer, nullable=False, index=True)
    status = Column(String(30), default="ACTIVE", nullable=False)
    payment_method = Column(String(50), default="Card", nullable=False)
    invoice_code = Column(String(40), default="SLG-0000", nullable=False)
    price_paid_cents = Column(Integer, nullable=False)
    selgo_commission_cents = Column(Integer, nullable=False)
    developer_payout_cents = Column(Integer, nullable=False)
    tasks_completed = Column(Integer, default=0, nullable=False)
    minutes_saved = Column(Integer, default=0, nullable=False)
    chat_history_json = Column(Text, default="[]", nullable=False)
    agent_memory_json = Column(Text, default="{}", nullable=False)
    security_alert_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class AgentCommentModel(Base):
    __tablename__ = "agent_comments"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    author_name = Column(String(120), nullable=False)
    is_verified_subscriber = Column(Boolean, default=False, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class PayoutRequestModel(Base):
    __tablename__ = "payout_requests"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    payout_method = Column(String(80), nullable=False)
    Destination_account = Column(String(160), nullable=False)
    status = Column(String(30), default="PROCESSED", nullable=False)
    reference_code = Column(String(40), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class RLTrajectoryModel(Base):
    __tablename__ = "rl_trajectories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    state_context_json = Column(Text, default="{}", nullable=False)
    action_type = Column(String(60), nullable=False)
    target_agent_id = Column(Integer, nullable=True)
    reward_score = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()