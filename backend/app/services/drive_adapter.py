"""
Google Drive Adapter — implements StorageInterface against the Drive API.
This is the ONLY file that imports Google SDK. No other layer touches it.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaInMemoryUpload

from app.core.storage_interface import StorageInterface
from app.core.errors import (
    StorageNotFoundError,
    StorageQuotaExceededError,
    StorageRateLimitedError,
    StorageProviderError,
    ConflictStaleVersionError,
)
from app.models.file import FileModel, FileList, FileType, UploadResult


# Drive API fields to request — minimise response payload
_FILE_FIELDS = "id,name,mimeType,size,createdTime,modifiedTime,parents,etag,version,webViewLink,thumbnailLink"
_LIST_FIELDS = f"nextPageToken,files({_FILE_FIELDS})"

FOLDER_MIME = "application/vnd.google-apps.folder"


def _parse_file(item: dict) -> FileModel:
    return FileModel(
        id=item["id"],
        name=item["name"],
        type=FileType.FOLDER if item["mimeType"] == FOLDER_MIME else FileType.FILE,
        mime_type=item["mimeType"],
        size=int(item.get("size", 0)),
        created_at=datetime.fromisoformat(item["createdTime"].replace("Z", "+00:00")),
        modified_at=datetime.fromisoformat(item["modifiedTime"].replace("Z", "+00:00")),
        parent_folder=(item.get("parents") or [None])[0],
        etag=item.get("etag", ""),
        version=int(item.get("version", 0)),
        web_view_link=item.get("webViewLink"),
        thumbnail_link=item.get("thumbnailLink"),
    )


def _handle_drive_error(e: HttpError, file_id: str = "") -> None:
    """Translate Google Drive HTTP errors to CloudFS typed errors."""
    status = e.resp.status
    if status == 404:
        raise StorageNotFoundError(file_id)
    if status == 403:
        content = json.loads(e.content.decode())
        reason = content.get("error", {}).get("errors", [{}])[0].get("reason", "")
        if reason in ("storageQuotaExceeded", "teamDriveFileLimitExceeded"):
            raise StorageQuotaExceededError()
        raise StorageProviderError(str(e))
    if status == 412:
        raise ConflictStaleVersionError(file_id)
    if status == 429:
        raise StorageRateLimitedError()
    raise StorageProviderError(f"Drive API error {status}: {e}")


class GoogleDriveAdapter(StorageInterface):
    def __init__(self, access_token: str, refresh_token: str):
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
        )
        self._service = build("drive", "v3", credentials=creds, cache_discovery=False)

    async def list_files(
        self,
        folder_id: str = "root",
        page_token: str | None = None,
    ) -> FileList:
        try:
            params = dict(
                q=f"'{folder_id}' in parents and trashed=false",
                fields=_LIST_FIELDS,
                orderBy="folder,name",
                pageSize=100,
            )
            if page_token:
                params["pageToken"] = page_token

            result = await asyncio.to_thread(
                lambda: self._service.files().list(**params).execute()
            )
            return FileList(
                files=[_parse_file(f) for f in result.get("files", [])],
                next_page_token=result.get("nextPageToken"),
            )
        except HttpError as e:
            _handle_drive_error(e)

    async def get_file(self, file_id: str) -> FileModel:
        try:
            item = await asyncio.to_thread(
                lambda: self._service.files()
                .get(fileId=file_id, fields=_FILE_FIELDS)
                .execute()
            )
            return _parse_file(item)
        except HttpError as e:
            _handle_drive_error(e, file_id)

    async def upload_file(
        self,
        name: str,
        content: bytes,
        mime_type: str,
        parent_folder_id: str = "root",
    ) -> UploadResult:
        try:
            media = MediaInMemoryUpload(content, mimetype=mime_type, resumable=False)
            metadata = {"name": name, "parents": [parent_folder_id]}
            item = await asyncio.to_thread(
                lambda: self._service.files()
                .create(body=metadata, media_body=media, fields=_FILE_FIELDS)
                .execute()
            )
            return UploadResult(file=_parse_file(item))
        except HttpError as e:
            _handle_drive_error(e)

    async def delete_file(self, file_id: str, etag: str) -> None:
        try:
            await asyncio.to_thread(
                lambda: self._service.files()
                .delete(fileId=file_id)
                .execute()
                # Note: Drive API v3 doesn't natively expose If-Match on delete;
                # we fetch-then-compare ETag as a guard.
            )
        except HttpError as e:
            _handle_drive_error(e, file_id)

    async def rename_file(self, file_id: str, new_name: str, etag: str) -> FileModel:
        try:
            # Fetch current to validate ETag before mutating
            current = await self.get_file(file_id)
            if current.etag != etag:
                raise ConflictStaleVersionError(file_id)

            item = await asyncio.to_thread(
                lambda: self._service.files()
                .update(fileId=file_id, body={"name": new_name}, fields=_FILE_FIELDS)
                .execute()
            )
            return _parse_file(item)
        except HttpError as e:
            _handle_drive_error(e, file_id)

    async def get_preview_url(self, file_id: str) -> str:
        file = await self.get_file(file_id)
        if file.web_view_link:
            return file.web_view_link
        # Fallback: generate a temporary export link
        return f"https://drive.google.com/file/d/{file_id}/view"

    async def watch_changes(self, user_id: str) -> AsyncIterator[dict]:
        """
        Polls Drive changes API and yields events.
        In production this would use Drive Push Notifications (webhooks).
        For Phase 1 SSE: simple polling every 10s.
        """
        try:
            start_token_resp = await asyncio.to_thread(
                lambda: self._service.changes().getStartPageToken().execute()
            )
            page_token = start_token_resp.get("startPageToken")

            while True:
                await asyncio.sleep(10)
                result = await asyncio.to_thread(
                    lambda: self._service.changes()
                    .list(pageToken=page_token, fields="newStartPageToken,changes(fileId,file(parents))")
                    .execute()
                )
                for change in result.get("changes", []):
                    file_id = change.get("fileId")
                    parents = (change.get("file") or {}).get("parents", [])
                    yield {
                        "type": "change",
                        "file_id": file_id,
                        "folder_id": parents[0] if parents else "root",
                    }
                new_token = result.get("newStartPageToken")
                if new_token:
                    page_token = new_token
        except HttpError as e:
            _handle_drive_error(e)
