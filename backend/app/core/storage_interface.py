"""
Storage interface contract — the stable core layer.
All storage providers MUST implement this interface.
Core layer never imports provider-specific code (spec §3).
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.models.file import FileModel, FileList, UploadResult


class StorageInterface(ABC):
    """
    Abstract storage provider interface.
    Implementations: GoogleDriveAdapter (Phase 1), future providers.
    """

    @abstractmethod
    async def list_files(
        self,
        folder_id: str = "root",
        page_token: str | None = None,
    ) -> FileList:
        """List files in a folder. Raises StorageNotFoundError if folder missing."""
        ...

    @abstractmethod
    async def get_file(self, file_id: str) -> FileModel:
        """Get file metadata + ETag. Raises StorageNotFoundError if missing."""
        ...

    @abstractmethod
    async def upload_file(
        self,
        name: str,
        content: bytes,
        mime_type: str,
        parent_folder_id: str = "root",
    ) -> UploadResult:
        """Upload a new file. Raises StorageQuotaExceededError if quota full."""
        ...

    @abstractmethod
    async def delete_file(self, file_id: str, etag: str) -> None:
        """
        Delete a file. Requires ETag for optimistic locking.
        Raises ConflictStaleVersionError if ETag doesn't match.
        Raises StorageNotFoundError if already deleted.
        """
        ...

    @abstractmethod
    async def rename_file(self, file_id: str, new_name: str, etag: str) -> FileModel:
        """
        Rename or move a file. Requires ETag.
        Raises ConflictStaleVersionError on ETag mismatch.
        """
        ...

    @abstractmethod
    async def get_preview_url(self, file_id: str) -> str:
        """Return a short-lived preview URL for a file."""
        ...

    @abstractmethod
    async def watch_changes(self, user_id: str) -> AsyncIterator[dict]:
        """
        Async generator yielding change events for SSE stream.
        Yields dicts: {"type": "change", "folder_id": str, "file_id": str}
        """
        ...
