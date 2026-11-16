# api/app/session.py
"""Who is visiting. There is no login page.

The web app makes a random client ID the first time someone opens Selgo,
keeps it in the browser, and sends it on every request as the X-Client-ID
header. This file turns that ID into a Profile:

- get_profile: finds the visitor's profile, creating it on first use. Used by
  anything that saves data (chats, likes, purchases).
- get_optional_profile: finds the profile if it exists, never creates one.
  Used by pages anyone can read (the market), so browsing and bots don't
  fill the database with empty profiles.
- require_admin: lets only the Selgo admin through (publishing agents). The
  admin sends the secret ADMIN_KEY from api/.env as the X-Admin-Key header.
"""

import hashlib
import hmac
import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db, utcnow
from .models import Profile
from .schemas import ProfileOut, ProfileUpdateIn

router = APIRouter(prefix="/profile", tags=["profile"])

# crypto.randomUUID() in the browser makes 36 characters like this one:
# 3f1c2b9a-7d4e-4c1f-9a2b-1e5d6c7b8a90
CLIENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


def _hash_client_id(client_id: str) -> str:
    return hashlib.sha256(client_id.encode("utf-8")).hexdigest()


def _clean_client_id(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    client_id = raw.strip()
    if not CLIENT_ID_PATTERN.match(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The X-Client-ID header is not valid.",
        )
    return client_id


def _find(db: Session, client_id: str) -> Optional[Profile]:
    return db.scalar(
        select(Profile).where(Profile.client_id_hash == _hash_client_id(client_id))
    )


def get_optional_profile(
    x_client_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[Profile]:
    client_id = _clean_client_id(x_client_id)
    if client_id is None:
        return None
    return _find(db, client_id)


def get_profile(
    x_client_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Profile:
    client_id = _clean_client_id(x_client_id)
    if client_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing the X-Client-ID header.",
        )

    profile = _find(db, client_id)
    if profile is not None:
        profile.last_seen_at = utcnow()
        db.commit()
        return profile

    profile = Profile(client_id_hash=_hash_client_id(client_id))
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        # Two first requests arrived at the same moment and the other one
        # created the profile. Use that one.
        db.rollback()
        profile = _find(db, client_id)
        if profile is None:
            raise
    return profile


def require_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_KEY", "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin is not set up. Add ADMIN_KEY to api/.env and restart.",
        )
    given = (x_admin_key or "").strip()
    # compare_digest takes the same time whether the key is close or not,
    # so the key can't be guessed one character at a time.
    if not hmac.compare_digest(given.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only.")


# ---------- Routes ----------


@router.get("/me", response_model=ProfileOut)
def read_my_profile(profile: Profile = Depends(get_profile)) -> Profile:
    return profile


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    payload: ProfileUpdateIn,
    profile: Profile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> Profile:
    changes = payload.model_dump(exclude_unset=True)

    if changes.get("display_name") is not None:
        profile.display_name = changes["display_name"]
    if "company_name" in changes:
        profile.company_name = changes["company_name"] or None  # empty clears it
    if "avatar_url" in changes:
        profile.avatar_url = changes["avatar_url"]  # None removes the photo

    db.commit()
    return profile
