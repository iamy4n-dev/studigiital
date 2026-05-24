from __future__ import annotations

from pydantic import BaseModel

from app.skills.base import BaseSkill

_PROMPT = """\
Create high-quality Anki flashcards from the following text.
Each card must have a clear, specific question or concept on the front
and a concise, complete answer on the back.
Generate between 1 and 5 cards depending on content density.

Text:
{text}
"""


class FlashcardPair(BaseModel):
    front: str
    back: str


class GenerateFlashcardInput(BaseModel):
    text: str


class GenerateFlashcardOutput(BaseModel):
    cards: list[FlashcardPair]
    source_summary: str


class GenerateFlashcardSkill(BaseSkill[GenerateFlashcardInput, GenerateFlashcardOutput]):
    async def run(self, inp: GenerateFlashcardInput) -> GenerateFlashcardOutput:
        prompt = _PROMPT.format(text=inp.text)
        return await self._call_structured(prompt, GenerateFlashcardOutput)
