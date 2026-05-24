import pytest

from app.core.auth import get_current_user
from app.core.config import settings


@pytest.mark.asyncio
async def test_dev_mode_returns_paid_tier(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dev_mode", True)
    monkeypatch.setattr(settings, "clerk_secret_key", "")
    user = await get_current_user(None)
    assert user.user_id == "dev-user"
    assert user.tier == "paid"


@pytest.mark.asyncio
async def test_no_clerk_key_without_dev_mode_returns_free_tier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "dev_mode", False)
    monkeypatch.setattr(settings, "clerk_secret_key", "")
    user = await get_current_user(None)
    assert user.user_id == "dev-user"
    assert user.tier == "free"
