"""
Auth endpoints — Google OAuth flow + logout + silent token refresh + add-account flow.
"""
from fastapi import APIRouter, Depends, Response, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import httpx
import uuid

from app.config import get_settings
from app.db.database import get_db, UserToken, ConnectedAccount
from app.services.jwt_service import create_jwt, revoke_jwt
from app.services.token_encryption import encrypt_token, decrypt_token
from app.core.auth_deps import get_current_user
from app.core.errors import AuthGoogleRevokedError, AuthTokenInvalidError

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
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return RedirectResponse(auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handles two flows:
      1. Normal login  — state is None
      2. Add-account   — state = 'connect:<owner_user_id>'
    """
    try:
        flow = _make_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
    except Exception as e:
        print(f"OAuth token exchange error: {e}")
        raise AuthGoogleRevokedError()

    async with httpx.AsyncClient() as client:
        user_info_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
    user_info = user_info_resp.json()

    google_sub = user_info.get("id")
    email = user_info.get("email")
    display_name = user_info.get("name")
    avatar_url = user_info.get("picture")

    if not google_sub or not email:
        raise AuthGoogleRevokedError()

    refresh_token = credentials.refresh_token

    # ── Add-account flow ─────────────────────────────────────────────────
    if state and state.startswith("connect:"):
        owner_user_id = state.split(":", 1)[1]

        if not refresh_token:
            return RedirectResponse(f"{settings.frontend_url}/files?error=no_refresh_token")

        enc_token, iv = encrypt_token(refresh_token)

        existing_result = await db.execute(
            select(ConnectedAccount).where(
                ConnectedAccount.owner_user_id == owner_user_id,
                ConnectedAccount.google_sub == google_sub,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.encrypted_refresh_token = enc_token
            existing.refresh_token_iv = iv
            existing.display_name = display_name
            existing.avatar_url = avatar_url
            existing.revoked = False
        else:
            db.add(ConnectedAccount(
                id=str(uuid.uuid4()),
                owner_user_id=owner_user_id,
                google_sub=google_sub,
                email=email,
                display_name=display_name,
                avatar_url=avatar_url,
                encrypted_refresh_token=enc_token,
                refresh_token_iv=iv,
                is_primary=False,
            ))

        await db.commit()
        return RedirectResponse(f"{settings.frontend_url}/files?connected=1")

    # ── Normal login flow ────────────────────────────────────────────────
    if not refresh_token:
        existing_result = await db.execute(
            select(UserToken)
            .where(UserToken.user_id == google_sub, UserToken.revoked == False)
            .limit(1)
        )
        if not existing_result.scalar_one_or_none():
            raise AuthGoogleRevokedError()
    else:
        await db.execute(
            update(UserToken).where(UserToken.user_id == google_sub).values(revoked=True)
        )
        enc_token, iv = encrypt_token(refresh_token)
        db.add(UserToken(
            user_id=google_sub,
            email=email,
            refresh_token_enc=enc_token,
            refresh_token_iv=iv,
        ))

        # Seed primary ConnectedAccount (upsert)
        existing_primary_result = await db.execute(
            select(ConnectedAccount).where(
                ConnectedAccount.owner_user_id == google_sub,
                ConnectedAccount.google_sub == google_sub,
            )
        )
        existing_primary = existing_primary_result.scalar_one_or_none()

        if existing_primary:
            existing_primary.encrypted_refresh_token = enc_token
            existing_primary.refresh_token_iv = iv
            existing_primary.display_name = display_name
            existing_primary.avatar_url = avatar_url
            existing_primary.revoked = False
        else:
            db.add(ConnectedAccount(
                id=str(uuid.uuid4()),
                owner_user_id=google_sub,
                google_sub=google_sub,
                email=email,
                display_name=display_name,
                avatar_url=avatar_url,
                encrypted_refresh_token=enc_token,
                refresh_token_iv=iv,
                is_primary=True,
            ))

        await db.commit()

    jwt_token = await create_jwt(user_id=google_sub, email=email)
    return RedirectResponse(url=f"{settings.frontend_url}/auth/callback?token={jwt_token}")


@router.post("/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Silent token refresh — allows expired JWTs."""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.cookies.get("cloudfs_token")
    if not token:
        raise AuthTokenInvalidError()

    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
    except Exception:
        raise AuthTokenInvalidError()

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise AuthTokenInvalidError()

    result = await db.execute(
        select(UserToken)
        .where(UserToken.user_id == user_id, UserToken.revoked == False)
        .order_by(UserToken.created_at.desc())
        .limit(1)
    )
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise AuthGoogleRevokedError()

    google_refresh_token = decrypt_token(token_row.refresh_token_enc, token_row.refresh_token_iv)

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
        raise AuthGoogleRevokedError()

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
