from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class ArtifactType(StrEnum):
    NOTE = "note"
    FLASHCARD = "flashcard"
    QUIZ = "quiz"


class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    capture_id: str
    user_id: str
    artifact_type: ArtifactType
    content: dict
    created_at: datetime = Field(default_factory=datetime.utcnow)
