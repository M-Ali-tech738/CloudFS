"""
Core domain models — provider-agnostic.
These are the stable contracts between layers. Never import Google SDK here.
"""
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class FileType(str, Enum):
    FILE = "file"
    FOLDER = "folder"


class FileModel(BaseModel):
    """Unified file/folder representation across all storage providers."""
    id: str
    name: str
    type: FileType
    mime_type: str
    size: int  # bytes (0 for folders)
    created_at: datetime
    modified_at: datetime
    parent_folder: str | None = None
    etag: str  # Provider's resource version identifier — used for optimistic locking
    version: int = 0  # Monotonic counter, incremented on each write
    web_view_link: str | None = None
    thumbnail_link: str | None = None


class FileList(BaseModel):
    files: list[FileModel]
    next_page_token: str | None = None


class UploadResult(BaseModel):
    file: FileModel
    message: str = "Upload successful"


# ErrorDetail and ErrorResponse live in app/schemas/errors.py
