/**
 * API client — all backend communication.
 *
 * CRITICAL: This file must NEVER import Google Drive SDK or tokens.
 * The frontend only talks to the CloudFS backend (spec §3).
 * Auth is handled automatically via the HttpOnly cookie set by the backend.
 */
import type {
  FileList,
  FileModel,
  UploadResult,
  ApiError,
  UserInfo,
  ErrorCode,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Error handling ────────────────────────────────────────────────────────────

export class CloudFSApiError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public status: number,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "CloudFSApiError";
  }
}

async function parseError(res: Response): Promise<CloudFSApiError> {
  try {
    const body: ApiError = await res.json();
    return new CloudFSApiError(
      body.error.code,
      body.error.message,
      body.error.status,
      body.error.details
    );
  } catch {
    return new CloudFSApiError(
      "SERVER_INTERNAL",
      `HTTP ${res.status}`,
      res.status
    );
  }
}

// ── Retry strategy (spec §6) ──────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  code: ErrorCode,
  maxRetries = 4
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof CloudFSApiError && err.code === code && attempt < maxRetries) {
        const delay = code === "STORAGE_RATE_LIMITED"
          ? Math.pow(2, attempt) * 1000  // Exponential backoff: 1s, 2s, 4s, 8s
          : 2000;                          // Fixed 2s for STORAGE_PROVIDER_ERROR
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  /** If-Match ETag for optimistic locking on write operations */
  etag?: string;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { etag, ...init } = opts;
  const headers = new Headers(init.headers as HeadersInit);

  if (etag) headers.set("If-Match", etag);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // Send HttpOnly cookie automatically
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  /** Redirect to Google OAuth. Backend handles the full flow. */
  loginUrl: () => `${BASE}/auth/google/login`,

  me: () => apiFetch<UserInfo>("/auth/me"),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
};

// ── Files ─────────────────────────────────────────────────────────────────────

export const files = {
  list: (folderId = "root", pageToken?: string) =>
    withRetry(
      () =>
        apiFetch<FileList>(
          `/files?folder_id=${folderId}${pageToken ? `&page_token=${pageToken}` : ""}`
        ),
      "STORAGE_RATE_LIMITED"
    ),

  get: (fileId: string) =>
    withRetry(() => apiFetch<FileModel>(`/file/${fileId}`), "STORAGE_PROVIDER_ERROR"),

  upload: (file: File, folderId = "root") => {
    const form = new FormData();
    form.append("file", file);
    return withRetry(
      () =>
        apiFetch<UploadResult>(`/upload?folder_id=${folderId}`, {
          method: "POST",
          body: form,
        }),
      "STORAGE_RATE_LIMITED"
    );
  },

  delete: (fileId: string, etag: string) =>
    apiFetch<void>(`/file/${fileId}`, { method: "DELETE", etag }),

  rename: (fileId: string, newName: string, etag: string) =>
    withRetry(
      () =>
        apiFetch<FileModel>(`/file/${fileId}`, {
          method: "PATCH",
          etag,
          body: JSON.stringify({ name: newName }),
        }),
      "STORAGE_PROVIDER_ERROR"
    ),

  preview: (fileId: string) =>
    apiFetch<{ preview_url: string }>(`/preview/${fileId}`),
};

// ── SSE — change notifications ─────────────────────────────────────────────────

export function createEventSource(
  onEvent: (e: { type: string; folder_id?: string }) => void
): EventSource {
  const es = new EventSource(`${BASE}/events`, { withCredentials: true });
  es.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      // Ignore malformed events
    }
  };
  return es;
}
