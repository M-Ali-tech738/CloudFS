"""
FastAPI dependency — extracts JWT from Authorization header or cookie,
verifies it, and returns the current user's payload.
"""
from fastapi import Cookie, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db, UserToken
from app.services.jwt_service import verify_jwt
from app.services.token_encryption import decrypt_token
from app.core.errors import AuthTokenInvalidError, AuthGoogleRevokedError


async def get_current_user(
    request: Request,
    cloudfs_token: str | None = Cookie(default=None),
) -> dict:
    """
    Extracts JWT from:
    1. Authorization: Bearer <token> header (used by frontend on Vercel)
    2. HttpOnly cookie cloudfs_token (fallback)
    Raises AuthTokenInvalidError if neither is present or token is invalid.
    """
    token = None

    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]

    # Fall back to cookie
    if not token:
        token = cloudfs_token

    if not token:
        raise AuthTokenInvalidError()

    return await verify_jwt(token)


async def get_current_user_tokens(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[dict, str]:
    """
    Returns (jwt_payload, decrypted_refresh_token).
    Used by endpoints that need to call the Drive API.
    """
    user_id = user["sub"]
    result = await db.execute(
        select(UserToken)
        .where(UserToken.user_id == user_id, UserToken.revoked == False)
        .order_by(UserToken.created_at.desc())
        .limit(1)
    )
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise AuthGoogleRevokedError()

    refresh_token = decrypt_token(token_row.refresh_token_enc, token_row.refresh_token_iv)
    return user, refresh_token
