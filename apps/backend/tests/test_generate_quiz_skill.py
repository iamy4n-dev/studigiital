from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.generate_quiz import GenerateQuizInput, GenerateQuizSkill


@pytest.fixture
def skill() -> GenerateQuizSkill:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={
            "questions": [
                {
                    "stem": "What does mitochondria produce?",
                    "options": ["ATP", "Glucose", "Oxygen", "CO2"],
                    "correct_index": 0,
                    "explanation": "Mitochondria produce ATP via cellular respiration.",
                }
            ]
        }
    )
    return GenerateQuizSkill(backend, model="any-model")


async def test_skill_returns_questions_from_scenario_text(skill: GenerateQuizSkill) -> None:
    inp = GenerateQuizInput(text="Mitochondria produce ATP through cellular respiration.")
    out = await skill.run(inp)
    assert len(out.questions) >= 1
    q = out.questions[0]
    assert q.stem
    assert len(q.options) >= 2
    assert q.explanation


async def test_skill_sends_capture_text_to_llm(skill: GenerateQuizSkill) -> None:
    inp = GenerateQuizInput(text="Mitochondria produce ATP through cellular respiration.")
    await skill.run(inp)
    prompt_arg: str = skill._backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "Mitochondria" in prompt_arg


async def test_correct_index_must_be_within_options_bounds() -> None:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(
        return_value={
            "questions": [
                {
                    "stem": "What does mitochondria produce?",
                    "options": ["ATP", "Glucose", "Oxygen", "CO2"],
                    "correct_index": 99,  # out of bounds
                    "explanation": "some explanation",
                }
            ]
        }
    )
    skill = GenerateQuizSkill(backend, model="any-model")
    with pytest.raises(Exception):
        await skill.run(GenerateQuizInput(text="some text"))


async def test_skill_sends_flat_schema_to_llm(skill: GenerateQuizSkill) -> None:
    """Schema must have no $ref — local models don't expand JSON Schema references."""
    inp = GenerateQuizInput(text="Mitochondria produce ATP through cellular respiration.")
    await skill.run(inp)
    schema_arg: dict = skill._backend.call_structured.call_args.args[1]  # type: ignore[attr-defined]
    assert "$ref" not in str(schema_arg)
    assert "$defs" not in schema_arg


async def test_skill_rejects_invalid_llm_output() -> None:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(return_value={"wrong_key": "value"})
    skill = GenerateQuizSkill(backend, model="any-model")
    with pytest.raises(Exception):
        await skill.run(GenerateQuizInput(text="some text"))
