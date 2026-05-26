import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.config import settings
from app.core.llm import LLMBackend, get_llm_backend
from app.main import app


def _make_backend(*side_effects: dict) -> LLMBackend:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(side_effect=list(side_effects))
    return backend


@pytest.fixture
def mock_backend() -> LLMBackend:
    return _make_backend(
        {"skill_name": "generate_flashcard", "confidence": 0.95},
        {
            "cards": [
                {
                    "front": "What is photosynthesis?",
                    "back": "The process plants use to convert sunlight into energy",
                }
            ],
            "source_summary": "Biology text about photosynthesis",
        },
    )


@pytest.fixture(autouse=True)
def override_deps(mock_backend: LLMBackend) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_transform_returns_flashcard_schema(mock_backend: LLMBackend) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "Photosynthesis is the process plants use to make food from sunlight."},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["skill_name"] == "generate_flashcard"
    assert isinstance(body["cards"], list)
    assert len(body["cards"]) >= 1
    assert "front" in body["cards"][0]
    assert "back" in body["cards"][0]
    assert "source_summary" in body


@pytest.mark.asyncio
async def test_transform_calls_infer_then_generate(mock_backend: LLMBackend) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/captures/transform", json={"text": "Some text"})

    assert mock_backend.call_structured.call_count == 2  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_transform_empty_text_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/captures/transform", json={"text": ""})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_transform_paid_tier_uses_paid_model(mock_backend: LLMBackend) -> None:
    with patch("app.skills.registry.settings") as mock_settings:
        mock_settings.llm_model_infer = settings.llm_model_infer
        mock_settings.llm_model_free = "small-model"
        mock_settings.llm_model_paid = "large-model"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/api/v1/captures/transform",
                json={"text": "Photosynthesis is the process plants use to make food.", "tier": "paid"},
            )

    # second call_structured is the generate skill — its model arg should be the paid model
    generate_model_arg: str = mock_backend.call_structured.call_args_list[1].args[2]  # type: ignore[attr-defined]
    assert generate_model_arg == "large-model"


@pytest.mark.asyncio
async def test_transform_when_backend_raises_returns_500() -> None:
    broken_backend = MagicMock(spec=LLMBackend)
    broken_backend.call_structured = AsyncMock(side_effect=RuntimeError("LLM unavailable"))
    app.dependency_overrides[get_llm_backend] = lambda: broken_backend

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "Mitochondria is the powerhouse of the cell."},
        )

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_transform_when_backend_times_out_returns_500() -> None:
    timeout_backend = MagicMock(spec=LLMBackend)
    timeout_backend.call_structured = AsyncMock(side_effect=asyncio.TimeoutError())
    app.dependency_overrides[get_llm_backend] = lambda: timeout_backend

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "The speed of light is approximately 3×10⁸ m/s."},
        )

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_transform_with_skill_name_override_skips_infer() -> None:
    """When skill_name is supplied, the infer step is bypassed — only one LLM call."""
    direct_backend = _make_backend(
        {
            "cards": [{"front": "What do plants need for photosynthesis?", "back": "Sunlight"}],
            "source_summary": "Photosynthesis overview",
        }
    )
    app.dependency_overrides[get_llm_backend] = lambda: direct_backend

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={
                "text": "Photosynthesis is how plants make food from sunlight.",
                "skill_name": "generate_flashcard",
            },
        )

    assert response.status_code == 200
    assert direct_backend.call_structured.call_count == 1  # type: ignore[attr-defined]
    assert response.json()["skill_name"] == "generate_flashcard"


@pytest.mark.asyncio
async def test_transform_returns_note_schema_when_inferred() -> None:
    note_backend = _make_backend(
        {"skill_name": "generate_note", "confidence": 0.9},
        {
            "title": "How the Water Cycle Works",
            "body_markdown": "Water evaporates from oceans, condenses into clouds, and falls as rain...",
            "key_points": ["Evaporation", "Condensation", "Precipitation"],
        },
    )
    app.dependency_overrides[get_llm_backend] = lambda: note_backend

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "The water cycle describes how water moves through the environment."},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["skill_name"] == "generate_note"
    assert body["title"]
    assert body["body_markdown"]
    assert isinstance(body["key_points"], list)


@pytest.mark.asyncio
async def test_transform_returns_quiz_schema_when_inferred() -> None:
    quiz_backend = _make_backend(
        {"skill_name": "generate_quiz", "confidence": 0.85},
        {
            "questions": [
                {
                    "stem": "What is the first stage of the water cycle?",
                    "options": ["Evaporation", "Condensation", "Precipitation", "Runoff"],
                    "correct_index": 0,
                    "explanation": "Evaporation turns liquid water into vapour.",
                }
            ]
        },
    )
    app.dependency_overrides[get_llm_backend] = lambda: quiz_backend

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "The water cycle: evaporation, condensation, precipitation."},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["skill_name"] == "generate_quiz"
    assert isinstance(body["questions"], list)
    assert len(body["questions"]) >= 1
    q = body["questions"][0]
    assert q["stem"]
    assert isinstance(q["options"], list)
    assert "correct_index" in q
