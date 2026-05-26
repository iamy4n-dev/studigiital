from unittest.mock import MagicMock
from unittest.mock import patch

import pytest

from app.core.llm import LLMBackend
from app.skills.generate_flashcard import GenerateFlashcardSkill
from app.skills.registry import SkillRegistry


@pytest.fixture
def registry() -> SkillRegistry:
    return SkillRegistry(MagicMock(spec=LLMBackend))


def test_free_tier_returns_flashcard_skill(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "free")
    assert isinstance(skill, GenerateFlashcardSkill)


def test_paid_tier_returns_flashcard_skill(registry: SkillRegistry) -> None:
    skill = registry.get_generate_skill("generate_flashcard", "paid")
    assert isinstance(skill, GenerateFlashcardSkill)


def test_free_and_paid_tiers_use_different_models(registry: SkillRegistry) -> None:
    with patch("app.skills.registry.settings") as mock_settings:
        mock_settings.llm_model_free = "small-model"
        mock_settings.llm_model_paid = "large-model"
        mock_settings.llm_model_infer = "infer-model"

        free_skill = registry.get_generate_skill("generate_flashcard", "free")
        paid_skill = registry.get_generate_skill("generate_flashcard", "paid")

    assert free_skill.model == "small-model"
    assert paid_skill.model == "large-model"


def test_unknown_skill_raises(registry: SkillRegistry) -> None:
    with pytest.raises(ValueError, match="Unknown or unsupported skill"):
        registry.get_generate_skill("generate_note", "free")
