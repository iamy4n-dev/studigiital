from pydantic import BaseModel

from .models import CaptureMode, CaptureStatus


class CaptureCreate(BaseModel):
    user_id: str
    mode: CaptureMode
    raw_content: str | None = None
    media_key: str | None = None


class CaptureUpdate(BaseModel):
    status: CaptureStatus | None = None


class CaptureOut(BaseModel):
    id: str
    user_id: str
    mode: CaptureMode
    status: CaptureStatus
    created_at: str
    updated_at: str
