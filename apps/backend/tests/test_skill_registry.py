from unittest.mock import MagicMock

import anthropic
import pytest

from app.skills.generate_flashcard import GenerateFlashcardSkill
from app.skills.registry import SkillRegistry


@pytest.fixture
def registry() -> SkillRegistry:
    return SkillRegistry(MagicMock(spec=anthropic.AsyncAnthropic))


def test_free_tier_returns_flashcard_skill(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "free")
    assert isinstance(skill, GenerateFlashcardSkill)


def test_paid_tier_returns_flashcard_skill(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "paid")
    assert isinstance(skill, GenerateFlashcardSkill)


def test_free_tier_uses_small_model(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "free")
    assert "haiku" in skill.model


def test_paid_tier_uses_large_model(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "paid")
    assert "sonnet" in skill.model or "opus" in skill.model


def test_unknown_skill_raises(registry: SkillRegistry) -> None:
    with pytest.raises(ValueError, match="Unknown or unsupported skill"):
        registry.get_generate_skill("generate_note", "free")
