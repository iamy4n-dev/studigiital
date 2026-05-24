from unittest.mock import AsyncMock, MagicMock

import anthropic
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import get_anthropic_client
from app.main import app


def _make_tool_response(data: object) -> MagicMock:
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
        side_effect=[
            _make_tool_response({"skill_name": "generate_flashcard", "confidence": 0.95}),
            _make_tool_response(
                {
                    "cards": [
                        {
                            "front": "What is photosynthesis?",
                            "back": "The process plants use to convert sunlight into energy",
                        }
                    ],
                    "source_summary": "Biology text about photosynthesis",
                }
            ),
        ]
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


@pytest.mark.asyncio
async def test_transform_returns_flashcard_schema(
    mock_client: anthropic.AsyncAnthropic,
) -> None:
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
async def test_transform_calls_infer_then_generate(
    mock_client: anthropic.AsyncAnthropic,
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/captures/transform", json={"text": "Some text"})

    assert mock_client.messages.create.call_count == 2  # type: ignore[attr-defined]
