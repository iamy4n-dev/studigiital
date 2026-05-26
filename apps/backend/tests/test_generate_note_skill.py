from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.generate_note import GenerateNoteInput, GenerateNoteSkill


@pytest.fixture
def skill() -> GenerateNoteSkill:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={
            "title": "How Photosynthesis Works",
            "body_markdown": "Plants convert sunlight into glucose using chlorophyll...",
            "key_points": ["Requires sunlight", "Produces oxygen", "Occurs in chloroplasts"],
        }
    )
    return GenerateNoteSkill(backend, model="any-model")


async def test_skill_returns_title_body_and_key_points(skill: GenerateNoteSkill) -> None:
    out = await skill.run(GenerateNoteInput(text="Photosynthesis is how plants make food from sunlight."))
    assert out.title
    assert out.body_markdown
    assert len(out.key_points) >= 1


async def test_skill_sends_capture_text_to_llm(skill: GenerateNoteSkill) -> None:
    await skill.run(GenerateNoteInput(text="Photosynthesis converts sunlight to energy."))
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "Photosynthesis" in prompt_arg


async def test_skill_rejects_invalid_llm_output() -> None:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(return_value={"wrong_key": "value"})
    skill = GenerateNoteSkill(backend, model="any-model")
    with pytest.raises(Exception):
        await skill.run(GenerateNoteInput(text="some text"))
