from pydantic import BaseModel


class GenerateNoteInput(BaseModel):
    text: str
    tags: list[str] = []


class GenerateNoteOutput(BaseModel):
    title: str
    markdown: str
