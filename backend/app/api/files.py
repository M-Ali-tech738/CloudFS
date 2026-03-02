"""
Files API — all file operations including full Drive navigation and cross-account transfers.
"""
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, UploadFile, File, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
import httpx
import asyncio

from app.config import get_settings
from app.core.auth_deps import get_current_user_tokens, get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.errors import ValidationFileTooLargeError, ValidationBadRequestError, StorageProviderError
from app.models.file import FileList, FileModel, UploadResult
from app.services.drive_adapter import GoogleDriveAdapter
from app.services.token_encryption import decrypt_token
from app.db.database import get_db, ConnectedAccount
from sqlalchemy import select, and_

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


# ── Existing endpoints (updated with account_id) ─────────────────────────

@router.get("/files", response_model=FileList)
async def list_files(
    folder_id: str = Query(default="root"),
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None, description="Specific account ID to use"),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).list_files(folder_id=folder_id, page_token=page_token)


@router.get("/file/{file_id}", response_model=FileModel)
async def get_file(
    file_id: str, 
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens)
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_file(file_id)


@router.get("/search", response_model=FileList)
async def search_files(
    q: str = Query(..., description="Search query"),
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not q or len(q.strip()) < 1:
        raise ValidationBadRequestError("Search query cannot be empty")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).search_files(q.strip(), page_token)


@router.post("/upload", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: str = Query(default="root"),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise ValidationFileTooLargeError(max_bytes=settings.max_upload_bytes, actual_bytes=len(content))
    if not file.filename:
        raise ValidationBadRequestError("Filename is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).upload_file(
        name=file.filename, content=content,
        mime_type=file.content_type or "application/octet-stream",
        parent_folder_id=folder_id,
    )


@router.post("/folder", response_model=FileModel)
async def create_folder(
    body: dict,
    folder_id: str = Query(default="root"),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    name = body.get("name", "").strip()
    if not name:
        raise ValidationBadRequestError("Folder name is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).create_folder(name, folder_id)


@router.delete("/file/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    await _get_adapter(refresh_token, access_token).delete_file(file_id=file_id, etag=if_match)


@router.patch("/file/{file_id}", response_model=FileModel)
async def update_file(
    file_id: str,
    body: dict,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    new_name = body.get("name")
    if not new_name:
        raise ValidationBadRequestError("'name' field is required")
    return await adapter.rename_file(file_id=file_id, new_name=new_name, etag=if_match)


@router.post("/file/{file_id}/move", response_model=FileModel)
async def move_file(
    file_id: str,
    body: dict,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    destination = body.get("destination_folder_id")
    if not destination:
        raise ValidationBadRequestError("'destination_folder_id' is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).move_file(file_id, destination, if_match)


@router.post("/file/{file_id}/copy", response_model=FileModel)
async def copy_file(
    file_id: str,
    body: dict,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    destination = body.get("destination_folder_id")
    if not destination:
        raise ValidationBadRequestError("'destination_folder_id' is required")
    new_name = body.get("name")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).copy_file(file_id, destination, new_name)


@router.get("/file/{file_id}/download")
async def download_file(
    file_id: str,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    adapter = _get_adapter(refresh_token, access_token)
    file = await adapter.get_file(file_id)
    download_url = await adapter.get_download_url(file_id)

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


@router.post("/file/{file_id}/share")
async def share_file(
    file_id: str,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    link = await _get_adapter(refresh_token, access_token).get_share_link(file_id)
    return {"share_url": link}


@router.post("/files/bulk/delete")
async def bulk_delete(
    body: dict,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    file_ids = body.get("file_ids", [])
    etags = body.get("etags", {})
    if not file_ids:
        raise ValidationBadRequestError("'file_ids' is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).bulk_delete(file_ids, etags)


@router.post("/files/bulk/move")
async def bulk_move(
    body: dict,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    file_ids = body.get("file_ids", [])
    etags = body.get("etags", {})
    destination = body.get("destination_folder_id")
    if not file_ids or not destination:
        raise ValidationBadRequestError("'file_ids' and 'destination_folder_id' are required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).bulk_move(file_ids, destination, etags)


@router.get("/preview/{file_id}")
async def get_preview(
    file_id: str, 
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens)
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    url = await _get_adapter(refresh_token, access_token).get_preview_url(file_id)
    return {"preview_url": url}


@router.get("/events")
async def sse_events(
    request: Request,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
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


# ── New navigation endpoints ─────────────────────────────────────────────

@router.get("/recent", response_model=FileList)
async def get_recent_files(
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_recent_files(page_token)


@router.get("/starred", response_model=FileList)
async def get_starred_files(
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_starred_files(page_token)


@router.post("/file/{file_id}/star")
async def star_file(
    file_id: str,
    body: dict,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    starred = body.get("starred", True)
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    await _get_adapter(refresh_token, access_token).star_file(file_id, starred)
    return {"success": True, "starred": starred}


@router.get("/shared-with-me", response_model=FileList)
async def get_shared_with_me(
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_shared_with_me(page_token)


@router.get("/trash", response_model=FileList)
async def get_trash_files(
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_trash_files(page_token)


@router.post("/file/{file_id}/restore")
async def restore_from_trash(
    file_id: str,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    if not if_match:
        raise ValidationBadRequestError("If-Match header is required")
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    file = await _get_adapter(refresh_token, access_token).restore_from_trash(file_id, if_match)
    return file


@router.post("/trash/empty")
async def empty_trash(
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    await _get_adapter(refresh_token, access_token).empty_trash()
    return {"success": True}


@router.get("/storage/quota")
async def get_storage_quota(
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    quota = await _get_adapter(refresh_token, access_token).get_storage_quota()
    return quota


@router.get("/shared-drives", response_model=FileList)
async def get_shared_drives(
    page_token: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    return await _get_adapter(refresh_token, access_token).get_shared_drives(page_token)


@router.get("/file/{file_id}/metadata")
async def get_file_metadata(
    file_id: str,
    account_id: str | None = Query(default=None),
    auth: tuple = Depends(get_current_user_tokens),
):
    user, refresh_token, acc_id = auth
    access_token = await _fresh_access_token(refresh_token)
    metadata = await _get_adapter(refresh_token, access_token).get_file_metadata(file_id)
    return metadata


# ── Cross-account transfer endpoints ─────────────────────────────────────

@router.post("/transfer/cross-account")
async def transfer_cross_account(
    body: dict,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Transfer a file from one connected account to another.
    Body: {
        "source_account_id": "uuid",
        "destination_account_id": "uuid",
        "file_id": "google_file_id",
        "destination_folder_id": "optional_folder_id",
        "new_name": "optional_new_name",
        "move": false  # true for move (delete after copy), false for copy
    }
    """
    source_account_id = body.get("source_account_id")
    dest_account_id = body.get("destination_account_id")
    file_id = body.get("file_id")
    dest_folder_id = body.get("destination_folder_id", "root")
    new_name = body.get("new_name")
    should_move = body.get("move", False)
    
    if not source_account_id or not dest_account_id or not file_id:
        raise ValidationBadRequestError("source_account_id, destination_account_id, and file_id are required")
    
    user_id = user["sub"]
    
    # Get source account
    source_result = await db.execute(
        select(ConnectedAccount)
        .where(
            and_(
                ConnectedAccount.id == source_account_id,
                ConnectedAccount.owner_user_id == user_id,
                ConnectedAccount.revoked == False
            )
        )
    )
    source = source_result.scalar_one_or_none()
    if not source:
        raise ValidationBadRequestError("Source account not found")
    
    # Get destination account
    dest_result = await db.execute(
        select(ConnectedAccount)
        .where(
            and_(
                ConnectedAccount.id == dest_account_id,
                ConnectedAccount.owner_user_id == user_id,
                ConnectedAccount.revoked == False
            )
        )
    )
    dest = dest_result.scalar_one_or_none()
    if not dest:
        raise ValidationBadRequestError("Destination account not found")
    
    # Decrypt refresh tokens
    source_refresh = decrypt_token(source.encrypted_refresh_token, source.refresh_token_iv)
    dest_refresh = decrypt_token(dest.encrypted_refresh_token, dest.refresh_token_iv)
    
    # Create transfer task
    transfer_id = str(uuid.uuid4())
    
    # Run transfer in background
    background_tasks.add_task(
        _execute_cross_account_transfer,
        transfer_id=transfer_id,
        file_id=file_id,
        source_refresh=source_refresh,
        dest_refresh=dest_refresh,
        dest_folder_id=dest_folder_id,
        new_name=new_name,
        should_move=should_move,
        user_id=user_id,
    )
    
    return {
        "transfer_id": transfer_id,
        "status": "started",
        "message": "Transfer started in background"
    }


@router.get("/transfer/{transfer_id}/status")
async def get_transfer_status(
    transfer_id: str,
    user: dict = Depends(get_current_user),
):
    """Get status of a background transfer."""
    # In a real implementation, store status in Redis
    # For now, return mock status
    return {
        "transfer_id": transfer_id,
        "status": "in_progress",
        "progress": 50,
        "message": "Transferring file..."
    }


async def _execute_cross_account_transfer(
    transfer_id: str,
    file_id: str,
    source_refresh: str,
    dest_refresh: str,
    dest_folder_id: str,
    new_name: str | None,
    should_move: bool,
    user_id: str,
):
    """Background task for cross-account transfer."""
    try:
        # Get access tokens
        source_access = await _fresh_access_token(source_refresh)
        dest_access = await _fresh_access_token(dest_refresh)
        
        # Create adapter with source account
        source_adapter = _get_adapter(source_refresh, source_access)
        
        # Get file metadata from source
        file_meta = await source_adapter.get_file(file_id)
        
        # Download from source
        download_url = await source_adapter.get_download_url(file_id)
        async with httpx.AsyncClient() as client:
            download_resp = await client.get(
                download_url,
                headers={"Authorization": f"Bearer {source_access}"},
                follow_redirects=True,
            )
        
        if download_resp.status_code != 200:
            raise Exception(f"Download failed: {download_resp.status_code}")
        
        content = download_resp.content
        
        # Upload to destination
        dest_adapter = _get_adapter(dest_refresh, dest_access)
        result = await dest_adapter.upload_file(
            name=new_name or file_meta.name,
            content=content,
            mime_type=file_meta.mime_type,
            parent_folder_id=dest_folder_id,
        )
        
        # If move requested, delete from source
        if should_move:
            await source_adapter.delete_file(file_id, file_meta.etag)
        
        # Store success status in Redis (not implemented)
        print(f"Transfer {transfer_id} completed successfully")
        
    except Exception as e:
        print(f"Transfer {transfer_id} failed: {e}")
        # Store error status in Redis (not implemented)
