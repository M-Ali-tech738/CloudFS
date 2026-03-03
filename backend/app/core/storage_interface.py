"""
Storage interface contract — the stable core layer.
All storage providers MUST implement this interface.
Core layer never imports provider-specific code.
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.models.file import FileModel, FileList, UploadResult


class StorageInterface(ABC):

    @abstractmethod
    async def list_files(self, folder_id: str = "root", page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def get_file(self, file_id: str) -> FileModel: ...

    @abstractmethod
    async def upload_file(self, name: str, content: bytes, mime_type: str, parent_folder_id: str = "root") -> UploadResult: ...

    @abstractmethod
    async def delete_file(self, file_id: str, etag: str) -> None: ...

    @abstractmethod
    async def rename_file(self, file_id: str, new_name: str, etag: str) -> FileModel: ...

    @abstractmethod
    async def create_folder(self, name: str, parent_folder_id: str = "root") -> FileModel: ...

    @abstractmethod
    async def move_file(self, file_id: str, destination_folder_id: str, etag: str) -> FileModel: ...

    @abstractmethod
    async def copy_file(self, file_id: str, destination_folder_id: str, new_name: str | None = None) -> FileModel: ...

    @abstractmethod
    async def get_download_url(self, file_id: str) -> str: ...

    @abstractmethod
    async def get_share_link(self, file_id: str) -> str: ...

    @abstractmethod
    async def search_files(self, query: str, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def bulk_delete(self, file_ids: list[str], etags: dict[str, str]) -> dict: ...

    @abstractmethod
    async def bulk_move(self, file_ids: list[str], destination_folder_id: str, etags: dict[str, str]) -> dict: ...

    @abstractmethod
    async def get_preview_url(self, file_id: str) -> str: ...

    @abstractmethod
    async def watch_changes(self, user_id: str) -> AsyncIterator[dict]: ...

    # ── Navigation section methods ───────────────────────────────────────

    @abstractmethod
    async def get_recent_files(self, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def get_starred_files(self, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def get_shared_with_me(self, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def get_trash_files(self, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def get_storage_quota(self) -> dict: ...

    @abstractmethod
    async def get_shared_drives(self, page_token: str | None = None) -> FileList: ...

    @abstractmethod
    async def star_file(self, file_id: str, starred: bool = True) -> None: ...

    @abstractmethod
    async def restore_from_trash(self, file_id: str, etag: str) -> FileModel: ...

    @abstractmethod
    async def empty_trash(self) -> None: ...

    @abstractmethod
    async def get_file_metadata(self, file_id: str) -> dict: ...
