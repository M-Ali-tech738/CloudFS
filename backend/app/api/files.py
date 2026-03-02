"""
Files API — all file operations.
"""
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse
import httpx

from app.config import get_settings
from app.core.auth_deps import get_current_user_tokens
from app.core.errors import ValidationFileTooLargeError, ValidationBadRequestError
from app.models.file import FileList, FileModel, UploadResult
from app.services.drive_adapter import GoogleDriveAdapter

settings = get_settings()
router = APIRouter(prefix="", tags=["files"])


def _get_adapter(refresh_token: str, access_token: str = "") -> GoogleDriveAdapter:
    return GoogleDriveAdapter(access_token=access_token, refresh_token=refresh_token)


async def _fresh_access_token(refresh_token: str) -> str:
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


# ── List & Get ─────────────────────────────────────────────────────────────────

@router.get("/files", response_model=FileList)
async def list_files(
    folder_id: str = Query(default="root"),
    page_token: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).list_files(folder_id=folder_id, page_token=page_token)


@router.get("/file/{file_id}", response_model=FileModel)
async def get_file(file_id: str, auth: tuple = Depends(get_current_user_tokens)):
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_file(file_id)


# ── Search ─────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=FileList)
async def search_files(
    q: str = Query(..., description="Search query"),
    page_token: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not q or len(q.strip()) < 1:
        raise ValidationBadRequestError("Search query cannot be empty")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).search_files(q.strip(), page_token)


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: str = Query(default="root"),
    auth: tuple = Depends(get_current_user_tokens),
):
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise ValidationFileTooLargeError(max_bytes=settings.max_upload_bytes, actual_bytes=len(content))
    if not file.filename:
        raise ValidationBadRequestError("Filename is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).upload_file(
        name=file.filename, content=content,
        mime_type=file.content_type or "application/octet-stream",
        parent_folder_id=folder_id,
    )


# ── Create Folder ──────────────────────────────────────────────────────────────

@router.post("/folder", response_model=FileModel)
async def create_folder(
    body: dict,
    folder_id: str = Query(default="root"),
    auth: tuple = Depends(get_current_user_tokens),
):
    name = body.get("name", "").strip()
    if not name:
        raise ValidationBadRequestError("Folder name is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).create_folder(name, folder_id)


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/file/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    await _get_adapter(refresh_token, access_token).delete_file(file_id=file_id, etag=if_match)


# ── Rename ─────────────────────────────────────────────────────────────────────

@router.patch("/file/{file_id}", response_model=FileModel)
async def update_file(
    file_id: str,
    body: dict,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    new_name = body.get("name")
    if not new_name:
        raise ValidationBadRequestError("'name' field is required")
    return await adapter.rename_file(file_id=file_id, new_name=new_name, etag=if_match)


# ── Move ───────────────────────────────────────────────────────────────────────

@router.post("/file/{file_id}/move", response_model=FileModel)
async def move_file(
    file_id: str,
    body: dict,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    destination = body.get("destination_folder_id")
    if not destination:
        raise ValidationBadRequestError("'destination_folder_id' is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).move_file(file_id, destination, if_match)


# ── Copy ───────────────────────────────────────────────────────────────────────

@router.post("/file/{file_id}/copy", response_model=FileModel)
async def copy_file(
    file_id: str,
    body: dict,
    auth: tuple = Depends(get_current_user_tokens),
):
    destination = body.get("destination_folder_id")
    if not destination:
        raise ValidationBadRequestError("'destination_folder_id' is required")
    new_name = body.get("name")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).copy_file(file_id, destination, new_name)


# ── Download ───────────────────────────────────────────────────────────────────

@router.get("/file/{file_id}/download")
async def download_file(
    file_id: str,
    auth: tuple = Depends(get_current_user_tokens),
):
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    file = await adapter.get_file(file_id)
    download_url = await adapter.get_download_url(file_id)

    # Proxy the download through our backend so the user doesn't need Google auth
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            download_url,
            headers={"Authorization": f"Bearer {access_token}"},
            follow_redirects=True,
        )

    filename = file.name
    return StreamingResponse(
        content=resp.aiter_bytes(),
        media_type=resp.headers.get("content-type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Share ──────────────────────────────────────────────────────────────────────

@router.post("/file/{file_id}/share")
async def share_file(
    file_id: str,
    auth: tuple = Depends(get_current_user_tokens),
):
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    link = await _get_adapter(refresh_token, access_token).get_share_link(file_id)
    return {"share_url": link}


# ── Bulk Operations ────────────────────────────────────────────────────────────

@router.post("/files/bulk/delete")
async def bulk_delete(
    body: dict,
    auth: tuple = Depends(get_current_user_tokens),
):
    file_ids = body.get("file_ids", [])
    etags = body.get("etags", {})
    if not file_ids:
        raise ValidationBadRequestError("'file_ids' is required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).bulk_delete(file_ids, etags)


@router.post("/files/bulk/move")
async def bulk_move(
    body: dict,
    auth: tuple = Depends(get_current_user_tokens),
):
    file_ids = body.get("file_ids", [])
    etags = body.get("etags", {})
    destination = body.get("destination_folder_id")
    if not file_ids or not destination:
        raise ValidationBadRequestError("'file_ids' and 'destination_folder_id' are required")
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).bulk_move(file_ids, destination, etags)


# ── Preview ────────────────────────────────────────────────────────────────────

@router.get("/preview/{file_id}")
async def get_preview(file_id: str, auth: tuple = Depends(get_current_user_tokens)):
    _, refresh_token = auth
    access_token = await _fresh_access_token(refresh_token)
    url = await _get_adapter(refresh_token, access_token).get_preview_url(file_id)
    return {"preview_url": url}


# ── SSE ────────────────────────────────────────────────────────────────────────

@router.get("/events")
async def sse_events(
    request: Request,
    auth: tuple = Depends(get_current_user_tokens),
):
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
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
