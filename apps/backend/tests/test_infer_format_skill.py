from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.infer_format import InferFormatInput, InferFormatSkill


@pytest.fixture
def skill() -> InferFormatSkill:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={"skill_name": "generate_flashcard", "confidence": 0.9}
    )
    return InferFormatSkill(backend, model="any-model")


async def test_skill_infers_format_for_definition_text(skill: InferFormatSkill) -> None:
    inp = InferFormatInput(
        text="Photosynthesis: the process by which plants make food from sunlight."
    )
    out = await skill.run(inp)
    assert out.skill_name in {"generate_flashcard", "generate_note", "generate_quiz"}


async def test_skill_sends_capture_text_to_llm(skill: InferFormatSkill) -> None:
    await skill.run(InferFormatInput(text="Photosynthesis converts sunlight to energy."))
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "Photosynthesis" in prompt_arg


async def test_skill_returns_confidence_between_zero_and_one(skill: InferFormatSkill) -> None:
    out = await skill.run(
        InferFormatInput(text="Mitochondria is the powerhouse of the cell.")
    )
    assert 0.0 <= out.confidence <= 1.0


async def test_skill_rejects_unknown_skill_name_from_llm() -> None:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={"skill_name": "generate_image", "confidence": 0.9}
    )
    skill = InferFormatSkill(backend, model="any-model")
    with pytest.raises(Exception):
        await skill.run(InferFormatInput(text="a painting of a sunset"))
