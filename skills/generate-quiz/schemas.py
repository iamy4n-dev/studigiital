from pydantic import BaseModel, Field


class GenerateQuizInput(BaseModel):
    text: str
    tags: list[str] = []
    question_count: int = Field(default=5, ge=2, le=15)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=3, max_length=4)
    correct_index: int


class GenerateQuizOutput(BaseModel):
    questions: list[QuizQuestion]
