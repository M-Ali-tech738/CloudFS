"""
FastAPI application — main entry point.
Registers routers, global error handlers, CORS, and startup events.
"""
import logging
import traceback
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.errors import CloudFSError
from app.api import auth, files
from app.db.database import create_tables

settings = get_settings()
logger = logging.getLogger("cloudfs")

app = FastAPI(
    title="CloudFS API",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

# Get allowed origins from settings
allowed_origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag", "Content-Length", "Authorization"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(files.router)

# ── Global error handlers ─────────────────────────────────────────────────────

@app.exception_handler(CloudFSError)
async def cloudfs_error_handler(request: Request, exc: CloudFSError):
    """Convert all typed CloudFS errors to consistent JSON envelope."""
    return JSONResponse(
        status_code=exc.status,
        content=exc.to_response().model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled exceptions.
    Logs full trace, returns SERVER_INTERNAL with trace ID.
    """
    trace_id = str(uuid.uuid4())
    logger.error(
        "Unhandled exception",
        extra={
            "trace_id": trace_id,
            "endpoint": str(request.url.path),
            "method": request.method,
        },
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "SERVER_INTERNAL",
                "message": "An internal server error occurred.",
                "domain": "server",
                "status": 500,
                "details": {"trace_id": trace_id},
            }
        },
    )


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await create_tables()
    logger.info("CloudFS backend started")


# ── Debug endpoints ───────────────────────────────────────────────────────────

@app.get("/debug-cors")
async def debug_cors(request: Request):
    """Debug endpoint to check CORS configuration"""
    return {
        "frontend_url_setting": settings.frontend_url,
        "allowed_origins": allowed_origins,
        "environment": settings.environment,
        "is_production": settings.is_production,
        "request_origin": request.headers.get("origin"),
        "request_method": request.method,
        "request_url": str(request.url),
    }


@app.get("/test")
async def test():
    """Simple test endpoint to check if API is reachable"""
    return {"status": "ok", "message": "API is working"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug-auth")
async def debug_auth(request: Request):
    """Debug endpoint to check authentication cookies"""
    cookies = request.cookies
    headers = dict(request.headers)
    return {
        "cookies": cookies,
        "has_token": "cloudfs_token" in cookies,
        "authorization_header": headers.get("authorization"),
        "all_headers": {k: v for k, v in headers.items() if "cookie" not in k.lower()},
    }
