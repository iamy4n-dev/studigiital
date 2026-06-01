from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from botocore.exceptions import ClientError  # type: ignore[import-untyped]
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.core.llm import LLMBackend, get_llm_backend
from app.main import app

_FAKE_IMAGE = b"\xff\xd8\xff"
_FAKE_TEXT = "Photosynthesis converts sunlight into chemical energy."
_FAKE_TAGS = {"suggestions": ["biology", "photosynthesis"]}


@pytest.fixture
def mock_backend() -> LLMBackend:
    backend = MagicMock(spec=LLMBackend)
    backend.call_vision = AsyncMock(return_value=_FAKE_TEXT)
    backend.call_structured = AsyncMock(return_value=_FAKE_TAGS)
    return backend


@pytest.fixture(autouse=True)
def override_deps(mock_backend: LLMBackend) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(user_id="u1", tier="free")
    app.dependency_overrides[get_llm_backend] = lambda: mock_backend
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_ocr_endpoint_returns_text_and_tags() -> None:
    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg", "content_type": "image/jpeg"},
            )
    assert response.status_code == 200
    body = response.json()
    assert body["extracted_text"] == _FAKE_TEXT
    assert body["suggested_tags"] == ["biology", "photosynthesis"]


@pytest.mark.asyncio
async def test_ocr_endpoint_calls_vision_then_suggest_tags(mock_backend: LLMBackend) -> None:
    with patch("app.api.v1.captures.download_s3_object", return_value=_FAKE_IMAGE):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg"},
            )
    mock_backend.call_vision.assert_called_once()  # type: ignore[attr-defined]
    mock_backend.call_structured.assert_called_once()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_ocr_endpoint_requires_auth() -> None:
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/ocr",
            json={"media_key": "captures/u1/abc/photo.jpg"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_ocr_endpoint_returns_404_when_s3_key_missing() -> None:
    error_response = {"Error": {"Code": "NoSuchKey", "Message": "The key does not exist."}}
    s3_error = ClientError(error_response, "GetObject")
    with patch("app.api.v1.captures.download_s3_object", side_effect=s3_error):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/nonexistent.jpg"},
            )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_ocr_endpoint_rejects_other_users_media() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/ocr",
            json={"media_key": "captures/other-user/abc/photo.jpg"},
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_ocr_endpoint_returns_502_on_s3_error() -> None:
    error_response = {"Error": {"Code": "InternalError", "Message": "S3 is unavailable."}}
    s3_error = ClientError(error_response, "GetObject")
    with patch("app.api.v1.captures.download_s3_object", side_effect=s3_error):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/captures/ocr",
                json={"media_key": "captures/u1/abc/photo.jpg"},
            )
    assert response.status_code == 502
