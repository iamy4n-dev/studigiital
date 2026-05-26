from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
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
