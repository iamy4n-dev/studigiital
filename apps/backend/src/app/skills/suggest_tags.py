from __future__ import annotations

from pydantic import BaseModel, Field

from app.skills.base import BaseSkill

_PROMPT = """\
Given the following learning content, suggest 2-3 concise tags that categorize it.
Prefer existing tags when relevant. Return only tag names, no explanations.

Existing tags: {existing_tags}

Content:
{text}
"""


class SuggestTagsInput(BaseModel):
    text: str
    existing_tags: list[str] = Field(default_factory=list)


class SuggestTagsOutput(BaseModel):
    suggestions: list[str] = Field(min_length=1, max_length=3)


class SuggestTagsSkill(BaseSkill[SuggestTagsInput, SuggestTagsOutput]):
    async def run(self, inp: SuggestTagsInput) -> SuggestTagsOutput:
        existing = ", ".join(inp.existing_tags) if inp.existing_tags else "none"
        prompt = _PROMPT.format(text=inp.text, existing_tags=existing)
        return await self._call_structured(prompt, SuggestTagsOutput)
