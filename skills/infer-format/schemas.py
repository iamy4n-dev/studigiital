from pydantic import BaseModel


class InferFormatInput(BaseModel):
    text: str


class InferFormatOutput(BaseModel):
    skill_name: str  # "generate-note" | "generate-flashcard" | "generate-quiz"
    confidence: float
    reasoning: str
