from unittest.mock import AsyncMock, MagicMock

import anthropic
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import get_anthropic_client
from app.main import app


def _tool_response(data: object) -> MagicMock:
    block = MagicMock()
    block.type = "tool_use"
    block.input = data
    response = MagicMock()
    response.content = [block]
    return response


@pytest.fixture
def mock_client() -> anthropic.AsyncAnthropic:
    client = MagicMock(spec=anthropic.AsyncAnthropic)
    client.messages = MagicMock()
    client.messages.create = AsyncMock(
        return_value=_tool_response({"suggestions": ["biology", "photosynthesis"]})
    )
    return client  # type: ignore[return-value]


@pytest.fixture(autouse=True)
def override_deps(mock_client: anthropic.AsyncAnthropic) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_anthropic_client] = lambda: mock_client
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


async def test_suggest_tags_returns_suggestions(mock_client: anthropic.AsyncAnthropic) -> None:
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


async def test_suggest_tags_passes_existing_tags_to_skill(
    mock_client: anthropic.AsyncAnthropic,
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/v1/captures/suggest-tags",
            json={"text": "Some learning content.", "existing_tags": ["math", "physics"]},
        )

    call_kwargs = mock_client.messages.create.call_args.kwargs  # type: ignore[union-attr]
    prompt_content = call_kwargs["messages"][0]["content"]
    assert "math" in prompt_content
    assert "physics" in prompt_content
