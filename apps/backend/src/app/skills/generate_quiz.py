from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.skills.base import BaseSkill

_PROMPT = """\
Create 2-5 multiple-choice questions that test understanding of the following text.
Each question must have exactly 4 options and identify the correct answer by its 0-based index.
Include a brief explanation for why the correct answer is right.

Text:
{text}
"""


class QuizQuestion(BaseModel):
    stem: str
    options: list[str] = Field(min_length=2)
    correct_index: int
    explanation: str

    @model_validator(mode="after")
    def correct_index_in_bounds(self) -> QuizQuestion:
        if not (0 <= self.correct_index < len(self.options)):
            raise ValueError(
                f"correct_index {self.correct_index} is out of bounds "
                f"for {len(self.options)} options"
            )
        return self


class GenerateQuizInput(BaseModel):
    text: str


class GenerateQuizOutput(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=1, max_length=5)


class GenerateQuizSkill(BaseSkill[GenerateQuizInput, GenerateQuizOutput]):
    async def run(self, inp: GenerateQuizInput) -> GenerateQuizOutput:
        prompt = _PROMPT.format(text=inp.text)
        return await self._call_structured(prompt, GenerateQuizOutput)
