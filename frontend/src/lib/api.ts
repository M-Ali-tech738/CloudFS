/**
 * API client — all backend communication.
 */
import type {
  FileList,
  FileModel,
  UploadResult,
  ApiError,
  UserInfo,
  ErrorCode,
} from "@/types";

// Hardcoded fallback for production - ensures API calls go to Render even if env var is missing
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cloudfs-1.onrender.com';

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
    return new CloudFSApiError("SERVER_INTERNAL", `HTTP ${res.status}`, res.status);
  }
}

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
          ? Math.pow(2, attempt) * 1000
          : 2000;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// Read JWT token from cookie
function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cloudfs_token=([^;]+)/);
  return match ? match[1] : null;
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  etag?: string;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { etag, ...init } = opts;
  const headers = new Headers(init.headers as HeadersInit);

  // Attach token from cookie as Authorization header
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (etag) headers.set("If-Match", etag);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Use API_BASE constant with fallback
  const apiUrl = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(apiUrl, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const auth = {
  // Use API_BASE constant with fallback
  loginUrl: () => `${API_BASE}/auth/google/login`,
  me: () => apiFetch<UserInfo>("/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
};

export const files = {
  list: (folderId = "root", pageToken?: string) =>
    withRetry(
      () => apiFetch<FileList>(`/files?folder_id=${folderId}${pageToken ? `&page_token=${pageToken}` : ""}`),
      "STORAGE_RATE_LIMITED"
    ),

  get: (fileId: string) =>
    withRetry(() => apiFetch<FileModel>(`/file/${fileId}`), "STORAGE_PROVIDER_ERROR"),

  upload: (file: File, folderId = "root") => {
    const form = new FormData();
    form.append("file", file);
    return withRetry(
      () => apiFetch<UploadResult>(`/upload?folder_id=${folderId}`, { method: "POST", body: form }),
      "STORAGE_RATE_LIMITED"
    );
  },

  delete: (fileId: string, etag: string) =>
    apiFetch<void>(`/file/${fileId}`, { method: "DELETE", etag }),

  rename: (fileId: string, newName: string, etag: string) =>
    withRetry(
      () => apiFetch<FileModel>(`/file/${fileId}`, {
        method: "PATCH",
        etag,
        body: JSON.stringify({ name: newName }),
      }),
      "STORAGE_PROVIDER_ERROR"
    ),

  preview: (fileId: string) =>
    apiFetch<{ preview_url: string }>(`/preview/${fileId}`),
};

export function createEventSource(
  onEvent: (e: { type: string; folder_id?: string }) => void
): EventSource {
  const token = getToken();
  // Use API_BASE constant with fallback
  const url = `${API_BASE}/events${token ? `?token=${token}` : ""}`;
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      // Ignore malformed events
    }
  };
  return es;
}
