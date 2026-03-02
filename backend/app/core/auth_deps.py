"""
FastAPI dependency — extracts JWT from Authorization header or cookie,
verifies it, and returns the current user's payload with account context.
"""
from fastapi import Cookie, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.database import get_db, ConnectedAccount, UserToken
from app.services.jwt_service import verify_jwt
from app.services.token_encryption import decrypt_token
from app.core.errors import AuthTokenInvalidError, AuthGoogleRevokedError


async def get_current_user(
    request: Request,
    token: str | None = Query(None, description="JWT token (for SSE fallback)"),
    cloudfs_token: str | None = Cookie(default=None),
) -> dict:
    """
    Extracts JWT from (in order of preference):
    1. Authorization: Bearer <token> header
    2. 'token' query parameter (for SSE EventSource)
    3. HttpOnly cookie cloudfs_token
    Returns user payload.
    """
    jwt_token = None

    # 1. Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ", 1)[1]

    # 2. Try query parameter (for SSE)
    if not jwt_token and token:
        jwt_token = token

    # 3. Fall back to cookie
    if not jwt_token:
        jwt_token = cloudfs_token

    if not jwt_token:
        raise AuthTokenInvalidError()

    return await verify_jwt(jwt_token)


async def get_current_user_tokens(
    account_id: str | None = Query(None, description="Specific account ID to use"),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[dict, str, str | None]:
    """
    Returns (jwt_payload, decrypted_refresh_token, account_id).
    If account_id is provided, uses that specific connected account.
    Otherwise uses the primary account.
    """
    user_id = user["sub"]
    
    # If specific account requested
    if account_id:
        result = await db.execute(
            select(ConnectedAccount)
            .where(
                and_(
                    ConnectedAccount.id == account_id,
                    ConnectedAccount.owner_user_id == user_id,
                    ConnectedAccount.revoked == False
                )
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise AuthGoogleRevokedError()
        
        refresh_token = decrypt_token(
            account.encrypted_refresh_token,
            account.refresh_token_iv
        )
        return user, refresh_token, account_id
    
    # Otherwise get primary account
    result = await db.execute(
        select(ConnectedAccount)
        .where(
            and_(
                ConnectedAccount.owner_user_id == user_id,
                ConnectedAccount.is_primary == True,
                ConnectedAccount.revoked == False
            )
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        # Fallback to legacy user_tokens
        result = await db.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id, UserToken.revoked == False)
            .order_by(UserToken.created_at.desc())
            .limit(1)
        )
        token_row = result.scalar_one_or_none()
        if not token_row:
            raise AuthGoogleRevokedError()
        
        refresh_token = decrypt_token(
            token_row.refresh_token_enc,
            token_row.refresh_token_iv
        )
        return user, refresh_token, None
    
    refresh_token = decrypt_token(
        account.encrypted_refresh_token,
        account.refresh_token_iv
    )
    return user, refresh_token, account.id
