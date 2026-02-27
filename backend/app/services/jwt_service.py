"""
JWT service — issues backend session JWTs, verifies them, and manages
the Redis-backed blocklist for immediate revocation (spec §4).
"""
import uuid
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from jose import JWTError, jwt

from app.config import get_settings
from app.core.errors import AuthTokenExpiredError, AuthTokenInvalidError

settings = get_settings()

# Redis client (lazy singleton)
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _blocklist_key(jti: str) -> str:
    return f"jwt_blocklist:{jti}"


async def create_jwt(user_id: str, email: str) -> str:
    """Issue a signed JWT with 24h expiry. JTI enables revocation."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.jwt_expire_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def verify_jwt(token: str) -> dict:
    """
    Verify a JWT — checks signature, expiry, and Redis blocklist.
    Raises typed errors (never raw JWTError).
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as e:
        if "expired" in str(e).lower():
            raise AuthTokenExpiredError()
        raise AuthTokenInvalidError()

    jti = payload.get("jti")
    if jti:
        redis = await get_redis()
        if await redis.exists(_blocklist_key(jti)):
            raise AuthTokenInvalidError()  # Token was explicitly revoked

    return payload


async def revoke_jwt(token: str) -> None:
    """Add a JWT's JTI to the Redis blocklist until its natural expiry."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},  # Allow revocation of expired tokens too
        )
    except JWTError:
        return  # Already invalid, nothing to revoke

    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return

    ttl = max(0, int(exp - datetime.now(timezone.utc).timestamp()))
    if ttl > 0:
        redis = await get_redis()
        await redis.setex(_blocklist_key(jti), ttl, "1")
