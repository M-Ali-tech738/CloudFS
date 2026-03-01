"""
Auth endpoints — Google OAuth flow (spec §4, steps 1–10) + logout.
"""
from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.config import get_settings
from app.db.database import get_db, UserToken
from app.services.jwt_service import create_jwt, revoke_jwt
from app.services.token_encryption import encrypt_token
from app.core.auth_deps import get_current_user
from app.core.errors import AuthGoogleRevokedError

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
    """Step 2-3: Redirect browser to Google OAuth consent screen."""
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
    """
    Steps 4-7: Exchange auth code -> Google tokens -> redirect to Vercel
    with token so Vercel sets the cookie on its own domain (fixes cross-domain
    cookie issues on Android Chrome with third-party cookies blocked).
    """
    try:
        flow = _make_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
    except Exception as e:
        print(f"OAuth error: {e}")
        raise AuthGoogleRevokedError()

    # Get user info
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

    # Encrypt refresh token -> store in PostgreSQL
    refresh_token = credentials.refresh_token
    if not refresh_token:
        existing = await db.execute(
            select(UserToken)
            .where(UserToken.user_id == user_id, UserToken.revoked == False)
            .limit(1)
        )
        if not existing.scalar_one_or_none():
            print(f"No refresh token and none stored for user {user_id}")
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

    # Issue backend JWT
    jwt_token = await create_jwt(user_id=user_id, email=email)

    # Redirect to Vercel /auth/callback with token as query param
    # Vercel will set the cookie on its own domain — fixes cross-domain cookie issues
    return RedirectResponse(
        url=f"{settings.frontend_url}/auth/callback?token={jwt_token}"
    )


@router.post("/logout")
async def logout(
    response: Response,
    cloudfs_token: str | None = None,
    user: dict = Depends(get_current_user),
):
    """Revoke JWT (add JTI to Redis blocklist) and clear cookie."""
    if cloudfs_token:
        await revoke_jwt(cloudfs_token)
    response.delete_cookie("cloudfs_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Return current user info from JWT payload."""
    return {"user_id": user["sub"], "email": user["email"]}
