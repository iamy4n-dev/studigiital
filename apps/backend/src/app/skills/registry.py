from __future__ import annotations

import anthropic

from app.skills.generate_flashcard import GenerateFlashcardSkill
from app.skills.infer_format import InferFormatSkill

# Atomic skills always use a cheap/fast model.
_INFER_MODEL = "claude-haiku-4-5-20251001"

# Transformation models are tier-gated.
# Free tier uses a small model; paid tier uses a capable model.
# In tests both tiers may point to the same model — that is intentional.
_FREE_MODELS: dict[str, str] = {
    "generate_flashcard": "claude-haiku-4-5-20251001",
}
_PAID_MODELS: dict[str, str] = {
    "generate_flashcard": "claude-sonnet-4-6",
}


class SkillRegistry:
    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        self._client = client

    def get_infer_skill(self) -> InferFormatSkill:
        return InferFormatSkill(self._client, _INFER_MODEL)

    def get_generate_skill(self, skill_name: str, tier: str) -> GenerateFlashcardSkill:
        model_map = _PAID_MODELS if tier == "paid" else _FREE_MODELS
        if skill_name == "generate_flashcard":
            return GenerateFlashcardSkill(self._client, model_map["generate_flashcard"])
        raise ValueError(f"Unknown or unsupported skill: {skill_name!r}")
