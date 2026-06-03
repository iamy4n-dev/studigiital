from __future__ import annotations

from app.core.config import settings
from app.core.llm import LLMBackend
from app.skills.generate_flashcard import GenerateFlashcardSkill
from app.skills.generate_note import GenerateNoteSkill
from app.skills.generate_quiz import GenerateQuizSkill
from app.skills.infer_format import InferFormatSkill
from app.skills.ocr_extract import OcrExtractSkill


class SkillRegistry:
    def __init__(self, backend: LLMBackend) -> None:
        self._backend = backend

    def get_infer_skill(self) -> InferFormatSkill:
        return InferFormatSkill(self._backend, settings.llm_model_infer)

    def get_ocr_skill(self) -> OcrExtractSkill:
        return OcrExtractSkill(self._backend, settings.llm_model_ocr)

    def get_generate_skill(
        self, skill_name: str, tier: str
    ) -> GenerateFlashcardSkill | GenerateNoteSkill | GenerateQuizSkill:
        model = settings.llm_model_paid if tier == "paid" else settings.llm_model_free
        if skill_name == "generate_flashcard":
            return GenerateFlashcardSkill(self._backend, model)
        if skill_name == "generate_note":
            return GenerateNoteSkill(self._backend, model)
        if skill_name == "generate_quiz":
            return GenerateQuizSkill(self._backend, model)
        raise ValueError(f"Unknown or unsupported skill: {skill_name!r}")
