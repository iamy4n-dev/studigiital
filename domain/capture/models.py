from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class CaptureMode(StrEnum):
    PHOTO = "photo"
    QUICK_TEXT = "quick_text"
    BACKLOG = "backlog"


class CaptureStatus(StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    OFFLINE = "offline"
    FAILED = "failed"


class Capture(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    mode: CaptureMode
    status: CaptureStatus = CaptureStatus.PENDING
    raw_content: str | None = None
    media_key: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
