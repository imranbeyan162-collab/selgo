# api/app/schemas.py
"""Pydantic v2 request and response schemas."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["business_owner", "developer"]

# A photo from the Account page is sent as a small data URL, or a normal link.
MAX_AVATAR_LENGTH = 400_000


class MessageOut(BaseModel):
    ok: bool = True
    message: str


# ---------- Profile ----------


class ProfileOut(BaseModel):
    """What the browser gets back. The client ID is never included."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    avatar_url: Optional[str] = None
    role: Role
    company_name: Optional[str] = None
    created_at: datetime


class ProfileUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    role: Optional[Role] = None
    company_name: Optional[str] = Field(default=None, max_length=160)
    avatar_url: Optional[str] = Field(default=None, max_length=MAX_AVATAR_LENGTH)

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if not value.startswith(("data:image/", "https://")):
            raise ValueError("The photo must be an image file or an https link.")
        return value
