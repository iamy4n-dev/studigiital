from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import LLMBackend, get_llm_backend
from app.main import app


@pytest.fixture
def mock_backend() -> LLMBackend:
    backend = MagicMock(spec=LLMBackend)
    backend.call_structured = AsyncMock(return_value={"suggestions": ["biology", "photosynthesis"]})
    return backend


@pytest.fixture(autouse=True)
def override_deps(mock_backend: LLMBackend) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


async def test_suggest_tags_returns_suggestions(mock_backend: LLMBackend) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/suggest-tags",
            json={"text": "Plants use sunlight to make food via photosynthesis."},
        )

    assert response.status_code == 200
    body = response.json()
    assert "suggestions" in body
    assert isinstance(body["suggestions"], list)
    assert len(body["suggestions"]) >= 1


async def test_suggest_tags_empty_text_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/suggest-tags",
            json={"text": ""},
        )

    assert response.status_code == 422


async def test_suggest_tags_passes_existing_tags_to_skill(mock_backend: LLMBackend) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/v1/captures/suggest-tags",
            json={"text": "Some learning content.", "existing_tags": ["math", "physics"]},
        )

    prompt_arg: str = mock_backend.call_structured.call_args.args[0]  # type: ignore[attr-defined]
    assert "math" in prompt_arg
    assert "physics" in prompt_arg
