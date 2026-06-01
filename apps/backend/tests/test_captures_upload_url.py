from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import UserClaims, get_current_user
from app.main import app


@pytest.fixture(autouse=True)
def override_auth() -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    yield
    app.dependency_overrides.clear()


async def test_upload_url_returns_presigned_url_and_object_key():
    with patch("app.api.v1.captures.generate_presigned_put_url") as mock_presign:
        mock_presign.return_value = "https://s3.amazonaws.com/studigiital-media/key?sig=abc"

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            res = await client.post(
                "/api/v1/captures/upload-url",
                json={"filename": "photo.jpg", "content_type": "image/jpeg"},
            )

    assert res.status_code == 200
    data = res.json()
    assert data["upload_url"] == "https://s3.amazonaws.com/studigiital-media/key?sig=abc"
    assert "test-user" in data["object_key"]
    assert "photo.jpg" in data["object_key"]


async def test_upload_url_requires_auth():
    app.dependency_overrides.clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/v1/captures/upload-url",
            json={"filename": "photo.jpg", "content_type": "image/jpeg"},
        )
    assert res.status_code == 401
