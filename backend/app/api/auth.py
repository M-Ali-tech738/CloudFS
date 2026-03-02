"""
Auth endpoints — Google OAuth flow + logout + silent token refresh.
"""
from fastapi import APIRouter, Depends, Response, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.config import get_settings
from app.db.database import get_db, UserToken
from app.services.jwt_service import create_jwt, revoke_jwt, verify_jwt
from app.services.token_encryption import encrypt_token, decrypt_token
from app.core.auth_deps import get_current_user
from app.core.errors import AuthGoogleRevokedError, AuthTokenInvalidError, AuthTokenExpiredError

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive",
]


def _make_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


@router.get("/google/login")
async def google_login():
    flow = _make_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return RedirectResponse(auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        flow = _make_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
    except Exception as e:
        print(f"OAuth error: {e}")
        raise AuthGoogleRevokedError()

    async with httpx.AsyncClient() as client:
        user_info_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
    user_info = user_info_resp.json()

    user_id = user_info.get("id")
    email = user_info.get("email")

    if not user_id or not email:
        raise AuthGoogleRevokedError()

    refresh_token = credentials.refresh_token
    if not refresh_token:
        existing = await db.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id, UserToken.revoked == False)
            .limit(1)
        )
        if not existing.scalar_one_or_none():
            raise AuthGoogleRevokedError()
    else:
        await db.execute(
            __import__("sqlalchemy").update(UserToken)
            .where(UserToken.user_id == user_id)
            .values(revoked=True)
        )
        enc_token, iv = encrypt_token(refresh_token)
        token_row = UserToken(
            user_id=user_id,
            email=email,
            refresh_token_enc=enc_token,
            refresh_token_iv=iv,
        )
        db.add(token_row)
        await db.commit()

    jwt_token = await create_jwt(user_id=user_id, email=email)

    # Redirect to Vercel callback page to set cookie on same domain
    return RedirectResponse(
        url=f"{settings.frontend_url}/auth/callback?token={jwt_token}"
    )


@router.post("/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Silent token refresh — called by frontend when JWT expires.
    Uses the stored Google refresh token to verify the user still has
    valid Google access, then issues a fresh JWT.
    No login required.
    """
    # Extract expired token from Authorization header or cookie
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("cloudfs_token")
    if not token:
        raise AuthTokenInvalidError()

    # Decode WITHOUT verifying expiry — we allow expired tokens here
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},  # Allow expired tokens
        )
    except Exception:
        raise AuthTokenInvalidError()

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise AuthTokenInvalidError()

    # Get stored refresh token from DB
    result = await db.execute(
        select(UserToken)
        .where(UserToken.user_id == user_id, UserToken.revoked == False)
        .order_by(UserToken.created_at.desc())
        .limit(1)
    )
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise AuthGoogleRevokedError()

    # Verify Google refresh token is still valid by refreshing it
    google_refresh_token = decrypt_token(
        token_row.refresh_token_enc,
        token_row.refresh_token_iv
    )

    try:
        creds = Credentials(
            token=None,
            refresh_token=google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )
        creds.refresh(GoogleRequest())
    except Exception as e:
        print(f"Google refresh failed: {e}")
        # Google token revoked — user must login again
        raise AuthGoogleRevokedError()

    # Issue new JWT
    new_jwt = await create_jwt(user_id=user_id, email=email)
    return {"token": new_jwt}


@router.post("/logout")
async def logout(
    response: Response,
    cloudfs_token: str | None = None,
    user: dict = Depends(get_current_user),
):
    if cloudfs_token:
        await revoke_jwt(cloudfs_token)
    response.delete_cookie("cloudfs_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user_id": user["sub"], "email": user["email"]}
