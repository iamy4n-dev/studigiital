from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_transform_without_token_returns_401_when_clerk_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "dev_mode", False)
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_fake")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/transform",
            json={"text": "some text"},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_suggest_tags_without_token_returns_401_when_clerk_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "dev_mode", False)
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_fake")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/captures/suggest-tags",
            json={"text": "some text"},
        )

    assert response.status_code == 401
