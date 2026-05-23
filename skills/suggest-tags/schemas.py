from pydantic import BaseModel, Field


class SuggestTagsInput(BaseModel):
    text: str
    existing_tags: list[str] = Field(default_factory=list)


class SuggestTagsOutput(BaseModel):
    suggestions: list[str] = Field(max_length=3)
