# api/app/schemas.py
"""Pydantic v2 request and response schemas."""

from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Photos are sent as a small data URL (made in the browser), or a normal link.
MAX_AVATAR_LENGTH = 400_000


def _clean_image(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    if not value.startswith(("data:image/", "https://")):
        raise ValueError("The photo must be an image file or an https link.")
    return value


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
        return _clean_image(value)


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
    # Agents the mentor recommends in this answer (usually none).
    recommendations: List["AgentOut"] = Field(default_factory=list)


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    updated_at: datetime


class ChatMessageOut(BaseModel):
    id: int
    role: ChatRole
    content: str
    created_at: datetime
    recommendations: List["AgentOut"] = Field(default_factory=list)


class ChatSessionDetailOut(ChatSessionOut):
    messages: List[ChatMessageOut]


# ---------- Agents ----------


class ReactionType(str, Enum):
    like = "like"
    save = "save"
    boost = "boost"


class AgentOut(BaseModel):
    """The public marketplace card. Never includes the instructions."""

    id: int
    slug: str  # the agent's folder name in api/agents/
    name: str
    industry: str
    tagline: str
    description: str
    monthly_price: float
    expert_name: Optional[str] = None
    expert_title: Optional[str] = None
    expert_bio: Optional[str] = None
    # A path on this API (or an https link). The photo itself isn't in the card,
    # which keeps the market list fast.
    expert_photo_url: Optional[str] = None
    knowledge_sources: int
    likes: int
    saves: int
    boosts: int
    comments: int
    my_reactions: List[ReactionType]
    created_at: datetime


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


# ---------- Workspace (subscriptions) ----------

# trial_ended: the free trial is over and nothing has been paid yet.
SubscriptionStatus = Literal["trial", "active", "trial_ended", "cancelled"]


class SubscribeIn(BaseModel):
    agent_id: int


class SubscriptionOut(BaseModel):
    id: int
    status: SubscriptionStatus
    can_use: bool  # False when the trial ended, it's cancelled, or the agent was withdrawn
    trial_days_left: Optional[int] = None
    monthly_price: float  # the price when they subscribed
    business_context: str
    custom_instructions: str
    created_at: datetime
    agent: AgentOut


class SubscriptionSettingsIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    business_context: Optional[str] = Field(default=None, max_length=4000)
    custom_instructions: Optional[str] = Field(default=None, max_length=4000)


class WorkspaceChatIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=4000)


class WorkspaceMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: ChatRole
    content: str
    created_at: datetime


class WorkspaceChatOut(BaseModel):
    reply: WorkspaceMessageOut
    question: WorkspaceMessageOut

# The chat schemas above refer to AgentOut, which is defined further down.
MentorChatOut.model_rebuild()
ChatMessageOut.model_rebuild()
ChatSessionDetailOut.model_rebuild()
