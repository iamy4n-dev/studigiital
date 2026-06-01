from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import LLMBackend, get_llm_backend
from app.main import app

_FAKE_IMAGE = b"\xff\xd8\xff"
_FAKE_TEXT = "Photosynthesis converts sunlight into chemical energy."
_FAKE_TAGS = {"suggestions": ["biology", "photosynthesis"]}


def _make_ocr_backend() -> LLMBackend:
    backend = MagicMock(spec=LLMBackend)
    backend.call_vision = AsyncMock(return_value=_FAKE_TEXT)
    backend.call_structured = AsyncMock(return_value=_FAKE_TAGS)
    return backend


@pytest.mark.asyncio
async def test_ocr_endpoint_returns_text_and_tags() -> None:
    mock_backend = _make_ocr_backend()
    app.dependency_overrides[get_current_user] = lambda: UserClaims(user_id="u1", tier="free")
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend

    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg", "content_type": "image/jpeg"},
            )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["extracted_text"] == _FAKE_TEXT
    assert body["suggested_tags"] == ["biology", "photosynthesis"]


@pytest.mark.asyncio
async def test_ocr_endpoint_calls_vision_then_suggest_tags() -> None:
    mock_backend = _make_ocr_backend()
    app.dependency_overrides[get_current_user] = lambda: UserClaims(user_id="u1", tier="free")
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend

    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg"},
            )

    app.dependency_overrides.clear()
    mock_backend.call_vision.assert_called_once()  # type: ignore[attr-defined]
    mock_backend.call_structured.assert_called_once()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_ocr_endpoint_requires_auth() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/ocr",
            json={"media_key": "captures/u1/abc/photo.jpg"},
        )
    assert response.status_code == 401
