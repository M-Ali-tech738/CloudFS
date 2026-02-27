"""
Test suite — Phase 1 backend.
Covers: JWT lifecycle, token encryption, error codes.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock


# ── Token encryption ──────────────────────────────────────────────────────────

class TestTokenEncryption:
    def test_roundtrip(self, monkeypatch):
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "a" * 64)
        # Reinitialise settings after env patch
        from importlib import reload
        import app.config as cfg
        cfg.get_settings.cache_clear()
        monkeypatch.setattr(cfg, "_settings", None, raising=False)

        from app.services.token_encryption import encrypt_token, decrypt_token
        plaintext = "ya29.super_secret_refresh_token"
        ciphertext, iv = encrypt_token(plaintext)
        assert ciphertext != plaintext.encode()
        assert decrypt_token(ciphertext, iv) == plaintext

    def test_unique_ivs(self, monkeypatch):
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "b" * 64)
        from app.services.token_encryption import encrypt_token
        _, iv1 = encrypt_token("token")
        _, iv2 = encrypt_token("token")
        assert iv1 != iv2  # Each encryption uses fresh nonce


# ── JWT service ───────────────────────────────────────────────────────────────

class TestJWTService:
    @pytest.mark.asyncio
    async def test_create_and_verify(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "x" * 64)
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "y" * 64)
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")

        from app.services import jwt_service

        with patch.object(jwt_service, "get_redis") as mock_redis_fn:
            mock_redis = AsyncMock()
            mock_redis.exists = AsyncMock(return_value=False)
            mock_redis_fn.return_value = mock_redis

            token = await jwt_service.create_jwt("user123", "test@example.com")
            assert isinstance(token, str)

            payload = await jwt_service.verify_jwt(token)
            assert payload["sub"] == "user123"
            assert payload["email"] == "test@example.com"
            assert "jti" in payload

    @pytest.mark.asyncio
    async def test_revoked_token_rejected(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "x" * 64)
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "y" * 64)
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")

        from app.services import jwt_service
        from app.core.errors import AuthTokenInvalidError

        with patch.object(jwt_service, "get_redis") as mock_redis_fn:
            mock_redis = AsyncMock()
            mock_redis.exists = AsyncMock(return_value=True)  # Simulate blocklisted
            mock_redis_fn.return_value = mock_redis

            token = await jwt_service.create_jwt("user456", "x@y.com")

            with pytest.raises(AuthTokenInvalidError):
                await jwt_service.verify_jwt(token)

    @pytest.mark.asyncio
    async def test_invalid_token_rejected(self):
        from app.services.jwt_service import verify_jwt
        from app.core.errors import AuthTokenInvalidError

        with pytest.raises(AuthTokenInvalidError):
            await verify_jwt("not.a.real.jwt")


# ── Error taxonomy ────────────────────────────────────────────────────────────

class TestErrorTaxonomy:
    def test_all_error_codes_have_correct_domains(self):
        from app.core.errors import (
            AuthTokenExpiredError, AuthTokenInvalidError, AuthGoogleRevokedError,
            PermForbiddenError, StorageNotFoundError, StorageQuotaExceededError,
            StorageRateLimitedError, StorageProviderError, ConflictStaleVersionError,
            ValidationBadRequestError, ValidationFileTooLargeError, ServerInternalError,
        )
        auth_errors = [AuthTokenExpiredError(), AuthTokenInvalidError(),
                       AuthGoogleRevokedError(), PermForbiddenError()]
        for e in auth_errors:
            assert e.domain == "auth"

        storage_errors = [StorageNotFoundError(), StorageQuotaExceededError(),
                          StorageRateLimitedError(), StorageProviderError()]
        for e in storage_errors:
            assert e.domain == "storage"

        assert ConflictStaleVersionError().domain == "conflict"
        assert ValidationBadRequestError().domain == "input"
        assert ValidationFileTooLargeError().domain == "input"
        assert ServerInternalError().domain == "server"

    def test_error_response_shape(self):
        from app.core.errors import StorageNotFoundError
        err = StorageNotFoundError("file_abc")
        resp = err.to_response()
        assert resp.error.code == "STORAGE_NOT_FOUND"
        assert resp.error.status == 404
        assert resp.error.details["file_id"] == "file_abc"

    def test_http_exception_status(self):
        from app.core.errors import ConflictStaleVersionError
        exc = ConflictStaleVersionError().to_http_exception()
        assert exc.status_code == 409


# ── Drive adapter error mapping ───────────────────────────────────────────────

class TestDriveAdapterErrorMapping:
    def test_404_maps_to_storage_not_found(self):
        from googleapiclient.errors import HttpError
        from app.services.drive_adapter import _handle_drive_error
        from app.core.errors import StorageNotFoundError

        mock_resp = MagicMock()
        mock_resp.status = 404
        err = HttpError(resp=mock_resp, content=b'{"error": {}}')

        with pytest.raises(StorageNotFoundError):
            _handle_drive_error(err, "file123")

    def test_429_maps_to_rate_limited(self):
        from googleapiclient.errors import HttpError
        from app.services.drive_adapter import _handle_drive_error
        from app.core.errors import StorageRateLimitedError

        mock_resp = MagicMock()
        mock_resp.status = 429
        err = HttpError(resp=mock_resp, content=b'{"error": {}}')

        with pytest.raises(StorageRateLimitedError):
            _handle_drive_error(err)
