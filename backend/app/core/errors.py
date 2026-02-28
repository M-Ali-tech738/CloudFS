"""
Error taxonomy per spec §6.
All backend errors use these typed codes. Never return raw exceptions.
"""
from fastapi import HTTPException
from app.schemas.errors import ErrorDetail, ErrorResponse


class CloudFSError(Exception):
    """Base exception. Maps to a typed error response."""
    def __init__(self, code: str, message: str, domain: str, status: int, details: dict = {}):
        self.code = code
        self.message = message
        self.domain = domain
        self.status = status
        self.details = details
        super().__init__(message)

    def to_response(self) -> ErrorResponse:
        return ErrorResponse(
            error=ErrorDetail(
                code=self.code,
                message=self.message,
                domain=self.domain,
                status=self.status,
                details=self.details,
            )
        )

    def to_http_exception(self) -> HTTPException:
        return HTTPException(
            status_code=self.status,
            detail=self.to_response().model_dump(),
        )


# ── Auth errors ──────────────────────────────────────────────────────────────

class AuthTokenExpiredError(CloudFSError):
    def __init__(self):
        super().__init__(
            code="AUTH_TOKEN_EXPIRED",
            message="Your session has expired. Please sign in again.",
            domain="auth",
            status=401,
        )


class AuthTokenInvalidError(CloudFSError):
    def __init__(self):
        super().__init__(
            code="AUTH_TOKEN_INVALID",
            message="Invalid or missing authentication token.",
            domain="auth",
            status=401,
        )


class AuthGoogleRevokedError(CloudFSError):
    def __init__(self):
        super().__init__(
            code="AUTH_GOOGLE_REVOKED",
            message="Google access has been revoked. Please sign in again.",
            domain="auth",
            status=401,
        )


class PermForbiddenError(CloudFSError):
    def __init__(self):
        super().__init__(
            code="PERM_FORBIDDEN",
            message="You do not have permission to access this resource.",
            domain="auth",
            status=403,
        )


# ── Storage errors ────────────────────────────────────────────────────────────

class StorageNotFoundError(CloudFSError):
    def __init__(self, file_id: str = ""):
        super().__init__(
            code="STORAGE_NOT_FOUND",
            message="File or folder not found.",
            domain="storage",
            status=404,
            details={"file_id": file_id},
        )


class StorageQuotaExceededError(CloudFSError):
    def __init__(self, quota_bytes: int = 0, used_bytes: int = 0):
        super().__init__(
            code="STORAGE_QUOTA_EXCEEDED",
            message="Your Google Drive storage quota has been reached.",
            domain="storage",
            status=507,
            details={"quota_bytes": quota_bytes, "used_bytes": used_bytes},
        )


class StorageRateLimitedError(CloudFSError):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            code="STORAGE_RATE_LIMITED",
            message="Google Drive API rate limit reached. Please try again shortly.",
            domain="storage",
            status=429,
            details={"retry_after_seconds": retry_after},
        )


class StorageProviderError(CloudFSError):
    def __init__(self, detail: str = ""):
        super().__init__(
            code="STORAGE_PROVIDER_ERROR",
            message="An unexpected error occurred with the storage provider.",
            domain="storage",
            status=502,
            details={"detail": detail},
        )


# ── Conflict errors ───────────────────────────────────────────────────────────

class ConflictStaleVersionError(CloudFSError):
    def __init__(self, file_id: str = ""):
        super().__init__(
            code="CONFLICT_STALE_VERSION",
            message="This resource was modified on another device. Please refresh and retry.",
            domain="conflict",
            status=409,
            details={"file_id": file_id},
        )


# ── Validation errors ─────────────────────────────────────────────────────────

class ValidationBadRequestError(CloudFSError):
    def __init__(self, detail: str = ""):
        super().__init__(
            code="VALIDATION_BAD_REQUEST",
            message=f"Invalid request: {detail}",
            domain="input",
            status=400,
        )


class ValidationFileTooLargeError(CloudFSError):
    def __init__(self, max_bytes: int = 0, actual_bytes: int = 0):
        super().__init__(
            code="VALIDATION_FILE_TOO_LARGE",
            message="Uploaded file exceeds the maximum allowed size.",
            domain="input",
            status=413,
            details={"max_bytes": max_bytes, "actual_bytes": actual_bytes},
        )


# ── Server errors ─────────────────────────────────────────────────────────────

class ServerInternalError(CloudFSError):
    def __init__(self, trace_id: str = ""):
        super().__init__(
            code="SERVER_INTERNAL",
            message="An internal server error occurred.",
            domain="server",
            status=500,
            details={"trace_id": trace_id},
        )
