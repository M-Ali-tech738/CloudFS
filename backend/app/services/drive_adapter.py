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

_FILE_FIELDS = "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,thumbnailLink"
_LIST_FIELDS = f"nextPageToken,files({_FILE_FIELDS})"
FOLDER_MIME = "application/vnd.google-apps.folder"


def _parse_file(item: dict) -> FileModel:
    etag = item.get("modifiedTime", "")
    return FileModel(
        id=item["id"],
        name=item["name"],
        type=FileType.FOLDER if item["mimeType"] == FOLDER_MIME else FileType.FILE,
        mime_type=item["mimeType"],
        size=int(item.get("size", 0)),
        created_at=datetime.fromisoformat(item["createdTime"].replace("Z", "+00:00")),
        modified_at=datetime.fromisoformat(item["modifiedTime"].replace("Z", "+00:00")),
        parent_folder=(item.get("parents") or [None])[0],
        etag=etag,
        version=0,
        web_view_link=item.get("webViewLink"),
        thumbnail_link=item.get("thumbnailLink"),
    )


def _handle_drive_error(e: HttpError, file_id: str = "") -> None:
    status = e.resp.status
    print(f"Drive API error {status}: {e.content}")
    if status == 404:
        raise StorageNotFoundError(file_id)
    if status == 403:
        try:
            content = json.loads(e.content.decode())
            reason = content.get("error", {}).get("errors", [{}])[0].get("reason", "")
        except Exception:
            reason = ""
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

    async def list_files(self, folder_id: str = "root", page_token: str | None = None) -> FileList:
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
        except Exception as e:
            print(f"Unexpected error in list_files: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def get_file(self, file_id: str) -> FileModel:
        try:
            item = await asyncio.to_thread(
                lambda: self._service.files().get(fileId=file_id, fields=_FILE_FIELDS).execute()
            )
            return _parse_file(item)
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in get_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def upload_file(self, name: str, content: bytes, mime_type: str, parent_folder_id: str = "root") -> UploadResult:
        try:
            media = MediaInMemoryUpload(content, mimetype=mime_type, resumable=False)
            metadata = {"name": name, "parents": [parent_folder_id]}
            item = await asyncio.to_thread(
                lambda: self._service.files().create(body=metadata, media_body=media, fields=_FILE_FIELDS).execute()
            )
            return UploadResult(file=_parse_file(item))
        except HttpError as e:
            _handle_drive_error(e)
        except Exception as e:
            print(f"Unexpected error in upload_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def delete_file(self, file_id: str, etag: str) -> None:
        try:
            current = await self.get_file(file_id)
            if current.etag != etag:
                raise ConflictStaleVersionError(file_id)
            await asyncio.to_thread(
                lambda: self._service.files().delete(fileId=file_id).execute()
            )
        except (ConflictStaleVersionError, StorageNotFoundError):
            raise
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in delete_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def rename_file(self, file_id: str, new_name: str, etag: str) -> FileModel:
        try:
            current = await self.get_file(file_id)
            if current.etag != etag:
                raise ConflictStaleVersionError(file_id)
            item = await asyncio.to_thread(
                lambda: self._service.files().update(fileId=file_id, body={"name": new_name}, fields=_FILE_FIELDS).execute()
            )
            return _parse_file(item)
        except (ConflictStaleVersionError, StorageNotFoundError):
            raise
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in rename_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def create_folder(self, name: str, parent_folder_id: str = "root") -> FileModel:
        try:
            metadata = {"name": name, "mimeType": FOLDER_MIME, "parents": [parent_folder_id]}
            item = await asyncio.to_thread(
                lambda: self._service.files().create(body=metadata, fields=_FILE_FIELDS).execute()
            )
            return _parse_file(item)
        except HttpError as e:
            _handle_drive_error(e)
        except Exception as e:
            print(f"Unexpected error in create_folder: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def move_file(self, file_id: str, destination_folder_id: str, etag: str) -> FileModel:
        try:
            current = await self.get_file(file_id)
            if current.etag != etag:
                raise ConflictStaleVersionError(file_id)
            old_parents = current.parent_folder or "root"
            item = await asyncio.to_thread(
                lambda: self._service.files().update(
                    fileId=file_id,
                    addParents=destination_folder_id,
                    removeParents=old_parents,
                    fields=_FILE_FIELDS,
                ).execute()
            )
            return _parse_file(item)
        except (ConflictStaleVersionError, StorageNotFoundError):
            raise
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in move_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def copy_file(self, file_id: str, destination_folder_id: str, new_name: str | None = None) -> FileModel:
        try:
            body: dict = {"parents": [destination_folder_id]}
            if new_name:
                body["name"] = new_name
            item = await asyncio.to_thread(
                lambda: self._service.files().copy(fileId=file_id, body=body, fields=_FILE_FIELDS).execute()
            )
            return _parse_file(item)
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in copy_file: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def get_download_url(self, file_id: str) -> str:
        """Returns a direct download URL for the file."""
        file = await self.get_file(file_id)
        # Google Docs files need export, binary files use direct download
        google_doc_mimes = {
            "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
        if file.mime_type in google_doc_mimes:
            export_mime = google_doc_mimes[file.mime_type]
            return f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType={export_mime}"
        return f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"

    async def get_share_link(self, file_id: str) -> str:
        """Make file publicly readable and return the share link."""
        try:
            # Create anyone-with-link permission
            await asyncio.to_thread(
                lambda: self._service.permissions().create(
                    fileId=file_id,
                    body={"type": "anyone", "role": "reader"},
                ).execute()
            )
            file = await self.get_file(file_id)
            return file.web_view_link or f"https://drive.google.com/file/d/{file_id}/view"
        except HttpError as e:
            _handle_drive_error(e, file_id)
        except Exception as e:
            print(f"Unexpected error in get_share_link: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def search_files(self, query: str, page_token: str | None = None) -> FileList:
        try:
            safe_query = query.replace("'", "\\'")
            params = dict(
                q=f"name contains '{safe_query}' and trashed=false",
                fields=_LIST_FIELDS,
                orderBy="folder,name",
                pageSize=50,
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
        except Exception as e:
            print(f"Unexpected error in search_files: {type(e).__name__}: {e}")
            raise StorageProviderError(str(e))

    async def bulk_delete(self, file_ids: list[str], etags: dict[str, str]) -> dict:
        """Delete multiple files. Returns {success: [...], failed: [...]}"""
        success, failed = [], []
        for file_id in file_ids:
            try:
                etag = etags.get(file_id, "")
                await self.delete_file(file_id, etag)
                success.append(file_id)
            except Exception as e:
                failed.append({"id": file_id, "error": str(e)})
        return {"success": success, "failed": failed}

    async def bulk_move(self, file_ids: list[str], destination_folder_id: str, etags: dict[str, str]) -> dict:
        """Move multiple files. Returns {success: [...], failed: [...]}"""
        success, failed = [], []
        for file_id in file_ids:
            try:
                etag = etags.get(file_id, "")
                await self.move_file(file_id, destination_folder_id, etag)
                success.append(file_id)
            except Exception as e:
                failed.append({"id": file_id, "error": str(e)})
        return {"success": success, "failed": failed}

    async def get_preview_url(self, file_id: str) -> str:
        file = await self.get_file(file_id)
        if file.web_view_link:
            return file.web_view_link
        return f"https://drive.google.com/file/d/{file_id}/view"

    async def watch_changes(self, user_id: str) -> AsyncIterator[dict]:
        try:
            start_token_resp = await asyncio.to_thread(
                lambda: self._service.changes().getStartPageToken().execute()
            )
            page_token = start_token_resp.get("startPageToken")
            while True:
                await asyncio.sleep(10)
                result = await asyncio.to_thread(
                    lambda: self._service.changes().list(
                        pageToken=page_token,
                        fields="newStartPageToken,changes(fileId,file(parents))",
                    ).execute()
                )
                for change in result.get("changes", []):
                    file_id = change.get("fileId")
                    parents = (change.get("file") or {}).get("parents", [])
                    yield {"type": "change", "file_id": file_id, "folder_id": parents[0] if parents else "root"}
                new_token = result.get("newStartPageToken")
                if new_token:
                    page_token = new_token
        except HttpError as e:
            _handle_drive_error(e)
        except Exception as e:
            print(f"Unexpected error in watch_changes: {type(e).__name__}: {e}")
