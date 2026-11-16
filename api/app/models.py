# api/app/models.py
"""SQLAlchemy models.

Step 1 holds visitor profiles. Mentor chats, agents, reactions,
subscriptions and payouts are added to this file in later steps.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base, UTCDateTime, utcnow

ROLE_BUSINESS_OWNER = "business_owner"
ROLE_DEVELOPER = "developer"


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
    role: Mapped[str] = mapped_column(String(32), default=ROLE_BUSINESS_OWNER)
    company_name: Mapped[Optional[str]] = mapped_column(String(160), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
