import pytest

from app.core.auth import get_current_user


@pytest.mark.asyncio
async def test_missing_token_raises_401() -> None:
    with pytest.raises(Exception) as exc_info:
        await get_current_user(None)
    assert exc_info.value.status_code == 401  # type: ignore[attr-defined]
