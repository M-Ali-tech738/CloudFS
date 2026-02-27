// ── File models ───────────────────────────────────────────────────────────────

export type FileType = "file" | "folder";

export interface FileModel {
  id: string;
  name: string;
  type: FileType;
  mime_type: string;
  size: number;
  created_at: string;
  modified_at: string;
  parent_folder: string | null;
  etag: string;        // Used for If-Match header on writes
  version: number;
  web_view_link: string | null;
  thumbnail_link: string | null;
}

export interface FileList {
  files: FileModel[];
  next_page_token: string | null;
}

export interface UploadResult {
  file: FileModel;
  message: string;
}

// ── Error codes (spec §6) ─────────────────────────────────────────────────────

export type ErrorCode =
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_GOOGLE_REVOKED"
  | "PERM_FORBIDDEN"
  | "STORAGE_NOT_FOUND"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_RATE_LIMITED"
  | "STORAGE_PROVIDER_ERROR"
  | "CONFLICT_STALE_VERSION"
  | "VALIDATION_BAD_REQUEST"
  | "VALIDATION_FILE_TOO_LARGE"
  | "SERVER_INTERNAL";

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  domain: string;
  status: number;
  details: Record<string, unknown>;
}

export interface ApiError {
  error: ErrorDetail;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface UserInfo {
  user_id: string;
  email: string;
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export interface ChangeEvent {
  type: "change" | "connected";
  file_id?: string;
  folder_id?: string;
}
