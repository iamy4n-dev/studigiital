import pytest
from httpx import ASGITransport, AsyncClient

import app.api.v1.users as users_module
from app.core.auth import UserClaims, get_current_user
from app.main import app


@pytest.fixture(autouse=True)
def setup(monkeypatch: pytest.MonkeyPatch) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="paid"
    )
    monkeypatch.setattr(users_module, "_profiles", {})
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_me_returns_current_user() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/users/me")
    assert response.status_code == 200
    assert response.json() == {"user_id": "test-user", "tier": "paid"}


@pytest.mark.asyncio
async def test_create_profile_returns_201() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/users/profile", json={"learning_type": "student"}
        )
    assert response.status_code == 201
    body = response.json()
    assert body["learning_type"] == "student"
    assert body["user_id"] == "test-user"


@pytest.mark.asyncio
async def test_get_profile_returns_saved_profile() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/users/profile", json={"learning_type": "professional"})
        response = await client.get("/api/v1/users/profile")
    assert response.status_code == 200
    assert response.json()["learning_type"] == "professional"


@pytest.mark.asyncio
async def test_get_profile_404_before_onboarding() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/users/profile")
    assert response.status_code == 404
