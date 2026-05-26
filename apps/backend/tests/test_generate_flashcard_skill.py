from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.generate_flashcard import GenerateFlashcardInput, GenerateFlashcardSkill


@pytest.fixture
def skill() -> GenerateFlashcardSkill:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={
            "cards": [
                {"front": "What is the powerhouse of the cell?", "back": "Mitochondria"}
            ],
            "source_summary": "Biology fact about mitochondria",
        }
    )
    return GenerateFlashcardSkill(backend, model="any-model")


async def test_skill_returns_cards_from_factual_text(skill: GenerateFlashcardSkill) -> None:
    inp = GenerateFlashcardInput(text="Mitochondria is the powerhouse of the cell.")
    out = await skill.run(inp)
    assert len(out.cards) >= 1
    assert out.source_summary


async def test_skill_sends_capture_text_to_llm(skill: GenerateFlashcardSkill) -> None:
    await skill.run(GenerateFlashcardInput(text="Mitochondria is the powerhouse of the cell."))
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "Mitochondria" in prompt_arg


async def test_each_card_has_non_empty_front_and_back(skill: GenerateFlashcardSkill) -> None:
    out = await skill.run(GenerateFlashcardInput(text="The capital of France is Paris."))
    for card in out.cards:
        assert card.front
        assert card.back


async def test_skill_rejects_invalid_llm_output() -> None:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(return_value={"wrong_key": "value"})
    skill = GenerateFlashcardSkill(backend, model="any-model")
    with pytest.raises(Exception):
        await skill.run(GenerateFlashcardInput(text="Mitochondria is the powerhouse of the cell."))
