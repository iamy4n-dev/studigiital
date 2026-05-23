from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str


class TagOut(BaseModel):
    id: str
    name: str
    color: str
    mastery_score: float


class SuggestedTagsOut(BaseModel):
    suggestions: list[str]
