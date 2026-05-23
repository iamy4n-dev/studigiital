from uuid import uuid4

from pydantic import BaseModel, Field


class Tag(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    name: str
    color: str
    mastery_score: float = 0.0


class TagSuggestion(BaseModel):
    name: str
    confidence: float
