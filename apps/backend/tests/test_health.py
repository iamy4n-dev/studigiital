from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# ---------------------------------------------------------------------------
# Slice 1 — health reports db ok when DB is reachable
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_reports_db_ok_when_reachable() -> None:
    with patch("app.main._check_db", AsyncMock(return_value=True)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["db"] == "ok"


# ---------------------------------------------------------------------------
# Slice 2 — health reports db error when DB is unreachable
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_reports_db_error_when_unreachable() -> None:
    with patch("app.main._check_db", AsyncMock(return_value=False)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["db"] == "error"
