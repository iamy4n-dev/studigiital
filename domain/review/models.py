from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class ReviewRating(StrEnum):
    GOT_IT = "got_it"
    NOT_YET = "not_yet"


class ReviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    artifact_id: str
    rating: ReviewRating
    created_at: datetime = Field(default_factory=datetime.utcnow)
