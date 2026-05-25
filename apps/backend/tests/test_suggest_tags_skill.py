from unittest.mock import AsyncMock, MagicMock

import anthropic
import pytest

from app.skills.suggest_tags import SuggestTagsInput, SuggestTagsSkill


def _tool_response(data: object) -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.input = data
    response = MagicMock()
    response.content = [block]
    return response


@pytest.fixture
def skill() -> SuggestTagsSkill:
    client = MagicMock(spec=anthropic.AsyncAnthropic)
    client.messages = MagicMock()
    client.messages.create = AsyncMock(
        return_value=_tool_response({"suggestions": ["biology", "photosynthesis"]})
    )
    return SuggestTagsSkill(client, model="claude-haiku-4-5-20251001")


async def test_skill_returns_suggestions_for_capture_text(skill: SuggestTagsSkill) -> None:
    out = await skill.run(SuggestTagsInput(text="Plants use sunlight to make food."))
    assert 1 <= len(out.suggestions) <= 3
    assert all(isinstance(s, str) and s for s in out.suggestions)


async def test_skill_sends_capture_text_to_llm(skill: SuggestTagsSkill) -> None:
    await skill.run(SuggestTagsInput(text="Mitochondria is the powerhouse of the cell."))
    call_kwargs = skill._client.messages.create.call_args.kwargs
    prompt_content = call_kwargs["messages"][0]["content"]
    assert "Mitochondria" in prompt_content


async def test_skill_includes_existing_tags_in_prompt(skill: SuggestTagsSkill) -> None:
    await skill.run(SuggestTagsInput(text="some text", existing_tags=["math", "biology"]))
    call_kwargs = skill._client.messages.create.call_args.kwargs
    prompt_content = call_kwargs["messages"][0]["content"]
    assert "math" in prompt_content
    assert "biology" in prompt_content
