from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
    return _jwks_client


class UserClaims(BaseModel):
    user_id: str
    tier: str = "free"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserClaims:
    # TODO(pre-release): Remove dev bypass — see issue #31 for full pre-release checklist
    if settings.dev_mode:
        return UserClaims(user_id="dev-user", tier="paid")
    if not settings.clerk_secret_key:
        return UserClaims(user_id="dev-user", tier="free")

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(credentials.credentials)
        payload: dict[str, object] = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
        )
        return UserClaims(
            user_id=str(payload["sub"]),
            tier=str(payload.get("tier", "free")),
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token",
        ) from exc
