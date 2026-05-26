from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.suggest_tags import SuggestTagsInput, SuggestTagsSkill


@pytest.fixture
def skill() -> SuggestTagsSkill:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(return_value={"suggestions": ["biology", "photosynthesis"]})
    return SuggestTagsSkill(backend, model="any-model")


async def test_skill_returns_suggestions_for_capture_text(skill: SuggestTagsSkill) -> None:
    out = await skill.run(SuggestTagsInput(text="Plants use sunlight to make food."))
    assert 1 <= len(out.suggestions) <= 3
    assert all(isinstance(s, str) and s for s in out.suggestions)


async def test_skill_sends_capture_text_to_llm(skill: SuggestTagsSkill) -> None:
    await skill.run(SuggestTagsInput(text="Mitochondria is the powerhouse of the cell."))
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "Mitochondria" in prompt_arg


async def test_skill_includes_existing_tags_in_prompt(skill: SuggestTagsSkill) -> None:
    await skill.run(SuggestTagsInput(text="some text", existing_tags=["math", "biology"]))
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "math" in prompt_arg
    assert "biology" in prompt_arg
