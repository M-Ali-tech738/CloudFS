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

// ── Connected Accounts ────────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_primary: boolean;
  last_used_at: string | null;
}

// ── Storage Quota ─────────────────────────────────────────────────────────────

export interface StorageQuota {
  limit: number;           // Total storage limit in bytes
  usage: number;           // Total usage in bytes
  usage_in_drive: number;  // Usage in My Drive
  usage_in_drive_trash: number;
  account_email: string;
  account_name: string;
}

// ── Navigation sections ───────────────────────────────────────────────────────

export type NavSection = 
  | "home"
  | "recent"
  | "starred"
  | "shared"
  | "trash"
  | "drives"
  | "my-drive"
  | "computers"
  | "storage";

// ── Transfer ──────────────────────────────────────────────────────────────────

export interface TransferRequest {
  source_account_id: string;
  destination_account_id: string;
  file_id: string;
  destination_folder_id?: string;
  new_name?: string;
  move?: boolean;
}

export interface TransferStatus {
  transfer_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;  // 0-100
  message?: string;
  error?: string;
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
