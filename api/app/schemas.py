# api/app/schemas.py
"""Pydantic v2 request and response schemas."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    company_name: Optional[str] = None
    created_at: datetime


class ProfileUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
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


# ---------- Mentor chat ----------

ChatRole = Literal["user", "assistant"]


class MentorChatIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=4000)
    # The saved chat to continue. Leave empty to start a new chat.
    session_id: Optional[int] = None


class MentorChatOut(BaseModel):
    reply: str
    session_id: int
    title: str


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    updated_at: datetime


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ChatRole
    content: str
    created_at: datetime


class ChatSessionDetailOut(ChatSessionOut):
    messages: List[ChatMessageOut]
