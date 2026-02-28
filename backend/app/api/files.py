"""
Files API — list, get, upload, delete, rename, preview, and SSE events.
All endpoints are [PROTECTED] and require valid JWT cookie.
Write operations require If-Match header for optimistic locking (spec §7).
"""
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, UploadFile, File, Query
from fastapi.responses import StreamingResponse
import httpx

from app.config import get_settings
from app.core.auth_deps import get_current_user_tokens
from app.core.errors import (
    ValidationFileTooLargeError,
    ValidationBadRequestError,
)
from app.models.file import FileList, FileModel, UploadResult
from app.services.drive_adapter import GoogleDriveAdapter

settings = get_settings()
router = APIRouter(prefix="", tags=["files"])


def _get_adapter(refresh_token: str, access_token: str = "") -> GoogleDriveAdapter:
    """Build a Drive adapter for the current user's session."""
    return GoogleDriveAdapter(
        access_token=access_token,
        refresh_token=refresh_token,
    )


async def _fresh_access_token(refresh_token: str) -> str:
    """Exchange refresh token for a fresh access token (in-memory, not stored)."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    return resp.json().get("access_token", "")


@router.get("/files", response_model=FileList)
async def list_files(
    folder_id: str = Query(default="root", description="Folder ID to list (default: root)"),
    page_token: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    """List files in a folder. Returns FileModel list with ETags."""
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    return await adapter.list_files(folder_id=folder_id, page_token=page_token)


@router.get("/file/{file_id}", response_model=FileModel)
async def get_file(
    file_id: str,
    auth: tuple = Depends(get_current_user_tokens),
):
    """Get file metadata + ETag. ETag must be sent back in If-Match for writes."""
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    return await adapter.get_file(file_id)


@router.post("/upload", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: str = Query(default="root"),
    auth: tuple = Depends(get_current_user_tokens),
):
    """Upload a file. Validates size before sending to Drive."""
    content = await file.read()

    if len(content) > settings.max_upload_bytes:
        raise ValidationFileTooLargeError(
            max_bytes=settings.max_upload_bytes,
            actual_bytes=len(content),
        )

    if not file.filename:
        raise ValidationBadRequestError("Filename is required")

    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)

    return await adapter.upload_file(
        name=file.filename,
        content=content,
        mime_type=file.content_type or "application/octet-stream",
        parent_folder_id=folder_id,
    )


@router.delete("/file/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    auth: tuple = Depends(get_current_user_tokens),
):
    """
    Delete a file. Requires If-Match: {etag} header for optimistic locking.
    Returns 409 CONFLICT_STALE_VERSION if ETag doesn't match.
    """
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required for delete operations")

    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    await adapter.delete_file(file_id=file_id, etag=if_match)


@router.patch("/file/{file_id}", response_model=FileModel)
async def rename_file(
    file_id: str,
    body: dict,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    auth: tuple = Depends(get_current_user_tokens),
):
    """
    Rename or move a file. Requires If-Match header.
    Body: {"name": "new-name.txt"}
    """
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required for rename operations")

    new_name = body.get("name")
    if not new_name:
        raise ValidationBadRequestError("'name' field is required in request body")

    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    return await adapter.rename_file(file_id=file_id, new_name=new_name, etag=if_match)


@router.get("/preview/{file_id}")
async def get_preview(
    file_id: str,
    auth: tuple = Depends(get_current_user_tokens),
):
    """Return preview URL for a file."""
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    url = await adapter.get_preview_url(file_id)
    return {"preview_url": url}


@router.get("/events")
async def sse_events(
    auth: tuple = Depends(get_current_user_tokens),
):
    """
    Server-Sent Events stream for real-time change notifications (spec §7).
    Frontend uses this to soft-refresh directory listings on other devices.
    """
    user, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)

    async def event_generator():
        yield "data: {\"type\": \"connected\"}\n\n"
        async for event in adapter.watch_changes(user_id=user["sub"]):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
