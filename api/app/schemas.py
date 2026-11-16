# api/app/schemas.py
"""Pydantic v2 request and response schemas."""

from datetime import datetime
from enum import Enum
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


# ---------- Agents ----------


class ReactionType(str, Enum):
    like = "like"
    save = "save"
    boost = "boost"


class AgentCreateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    industry: str = Field(min_length=2, max_length=80)
    tagline: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    system_prompt: str = Field(min_length=1, max_length=20000)
    monthly_price: float = Field(ge=0, le=100000)  # US dollars per month
    is_published: bool = True


class AgentUpdateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    industry: Optional[str] = Field(default=None, min_length=2, max_length=80)
    tagline: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    system_prompt: Optional[str] = Field(default=None, min_length=1, max_length=20000)
    monthly_price: Optional[float] = Field(default=None, ge=0, le=100000)
    is_published: Optional[bool] = None


class AgentOut(BaseModel):
    """The public marketplace card. Never includes the system prompt."""

    id: int
    name: str
    industry: str
    tagline: str
    description: str
    monthly_price: float
    likes: int
    saves: int
    boosts: int
    comments: int
    my_reactions: List[ReactionType]
    created_at: datetime


class AgentAdminOut(AgentOut):
    """What the Selgo admin sees."""

    system_prompt: str
    is_published: bool


class CommentIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    id: int
    agent_id: int
    author_name: str
    author_avatar: Optional[str] = None
    is_mine: bool
    body: str
    created_at: datetime


class ReactionOut(BaseModel):
    reaction_type: ReactionType
    active: bool  # True = this visitor's reaction is now on, False = removed
    likes: int
    saves: int
    boosts: int


class ChatTurn(BaseModel):
    """One message of a conversation the browser is holding (sandbox preview)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    role: ChatRole
    content: str = Field(min_length=1, max_length=4000)


class PreviewIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=1000)
    history: List[ChatTurn] = Field(default_factory=list, max_length=12)


class PreviewOut(BaseModel):
    reply: str
