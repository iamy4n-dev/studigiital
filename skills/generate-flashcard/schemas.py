from pydantic import BaseModel


class GenerateFlashcardInput(BaseModel):
    text: str
    tags: list[str] = []


class Flashcard(BaseModel):
    front: str
    back: str


class GenerateFlashcardOutput(BaseModel):
    cards: list[Flashcard]
