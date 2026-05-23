from enum import StrEnum

from .base import BaseSkill


class SkillName(StrEnum):
    OCR_EXTRACT = "ocr-extract"
    SUGGEST_TAGS = "suggest-tags"
    INFER_FORMAT = "infer-format"
    GENERATE_NOTE = "generate-note"
    GENERATE_FLASHCARD = "generate-flashcard"
    GENERATE_QUIZ = "generate-quiz"


_registry: dict[SkillName, BaseSkill] = {}


def register(name: SkillName, skill: BaseSkill) -> None:
    _registry[name] = skill


def get(name: SkillName) -> BaseSkill:
    if name not in _registry:
        raise KeyError(f"Skill '{name}' not registered")
    return _registry[name]


def registered_skills() -> list[SkillName]:
    return list(_registry.keys())
