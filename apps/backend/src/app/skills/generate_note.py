from __future__ import annotations

from pydantic import BaseModel, Field

from app.skills.base import BaseSkill

_PROMPT = """\
Create a structured learning note from the following text.
Include a clear, specific title, a full explanation in Markdown, and 3-5 concise key takeaways.

Text:
{text}
"""


class GenerateNoteInput(BaseModel):
    text: str


class GenerateNoteOutput(BaseModel):
    title: str
    body_markdown: str
    key_points: list[str] = Field(min_length=1, max_length=5)


class GenerateNoteSkill(BaseSkill[GenerateNoteInput, GenerateNoteOutput]):
    async def run(self, inp: GenerateNoteInput) -> GenerateNoteOutput:
        prompt = _PROMPT.format(text=inp.text)
        return await self._call_structured(prompt, GenerateNoteOutput)
