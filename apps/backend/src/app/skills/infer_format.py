from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.skills.base import BaseSkill

SkillName = Literal["generate_flashcard", "generate_note", "generate_quiz"]

_PROMPT = """\
Classify the following text to determine the best learning format.

Formats:
- generate_flashcard: facts, definitions, vocabulary, Q&A pairs
- generate_note: concepts, explanations, summaries, how-things-work
- generate_quiz: scenarios, problem-solving, application questions

Text:
{text}
"""


class InferFormatInput(BaseModel):
    text: str


class InferFormatOutput(BaseModel):
    skill_name: SkillName
    confidence: float


class InferFormatSkill(BaseSkill[InferFormatInput, InferFormatOutput]):
    async def run(self, inp: InferFormatInput) -> InferFormatOutput:
        prompt = _PROMPT.format(text=inp.text)
        return await self._call_structured(prompt, InferFormatOutput)
