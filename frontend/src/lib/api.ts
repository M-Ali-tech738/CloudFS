/**
 * API client — all backend communication.
 */
import type { FileList, FileModel, UploadResult, ApiError, UserInfo, ErrorCode, ConnectedAccount } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cloudfs.onrender.com";

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
    return new CloudFSApiError(body.error.code, body.error.message, body.error.status, body.error.details);
  } catch {
    return new CloudFSApiError("SERVER_INTERNAL", `HTTP ${res.status}`, res.status);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, code: ErrorCode, maxRetries = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof CloudFSApiError && err.code === code && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, code === "STORAGE_RATE_LIMITED" ? Math.pow(2, attempt) * 1000 : 2000));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cloudfs_token=([^;]+)/);
  return match ? match[1] : null;
}

export function setToken(token: string) {
  const maxAge = 30 * 24 * 60 * 60;
  document.cookie = ["cloudfs_token=" + token, "path=/", "max-age=" + maxAge, "SameSite=Strict",
    window.location.protocol === "https:" ? "Secure" : ""].filter(Boolean).join("; ");
}

export function clearToken() {
  document.cookie = "cloudfs_token=; path=/; max-age=0; SameSite=Strict";
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  etag?: string;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { etag, ...init } = opts;
  const headers = new Headers(init.headers as HeadersInit);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (etag) headers.set("If-Match", etag);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const apiUrl = `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
  const res = await fetch(apiUrl, { ...init, headers, credentials: "include" });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  loginUrl: () => `${API_BASE}/auth/google/login`,
  me: () => apiFetch<UserInfo>("/auth/me"),
  logout: async () => {
    try { await apiFetch<void>("/auth/logout", { method: "POST" }); } finally { clearToken(); }
  },
};

// ── Connected accounts ────────────────────────────────────────────────────────

export const accounts = {
  /** List all connected Google accounts for the current user. */
  list: () => apiFetch<ConnectedAccount[]>("/accounts"),

  /** Returns the URL to redirect the user to for adding another account. */
  connectUrl: () => `${API_BASE}/accounts/connect`,

  /** Soft-delete (revoke) a connected account. */
  disconnect: (accountId: string) =>
    apiFetch<void>(`/accounts/${accountId}`, { method: "DELETE" }),
};

// ── Files ─────────────────────────────────────────────────────────────────────

export const files = {
  list: (folderId = "root", pageToken?: string, accountId?: string) => {
    let url = `/files?folder_id=${folderId}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    if (accountId) url += `&account_id=${accountId}`;
    return withRetry(() => apiFetch<FileList>(url), "STORAGE_RATE_LIMITED");
  },

  get: (fileId: string, accountId?: string) => {
    let url = `/file/${fileId}`;
    if (accountId) url += `?account_id=${accountId}`;
    return withRetry(() => apiFetch<FileModel>(url), "STORAGE_PROVIDER_ERROR");
  },

  search: (q: string, pageToken?: string, accountId?: string) => {
    let url = `/search?q=${encodeURIComponent(q)}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    if (accountId) url += `&account_id=${accountId}`;
    return apiFetch<FileList>(url);
  },

  upload: (file: File, folderId = "root", accountId?: string) => {
    const form = new FormData();
    form.append("file", file);
    let url = `/upload?folder_id=${folderId}`;
    if (accountId) url += `&account_id=${accountId}`;
    return withRetry(() => apiFetch<UploadResult>(url, { method: "POST", body: form }), "STORAGE_RATE_LIMITED");
  },

  createFolder: (name: string, parentFolderId = "root", accountId?: string) => {
    let url = `/folder?folder_id=${parentFolderId}`;
    if (accountId) url += `&account_id=${accountId}`;
    return apiFetch<FileModel>(url, { method: "POST", body: JSON.stringify({ name }) });
  },

  delete: (fileId: string, etag: string, accountId?: string) => {
    let url = `/file/${fileId}`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<void>(url, { method: "DELETE", etag });
  },

  rename: (fileId: string, newName: string, etag: string, accountId?: string) => {
    let url = `/file/${fileId}`;
    if (accountId) url += `?account_id=${accountId}`;
    return withRetry(() => apiFetch<FileModel>(url, { method: "PATCH", etag, body: JSON.stringify({ name: newName }) }), "STORAGE_PROVIDER_ERROR");
  },

  move: (fileId: string, destinationFolderId: string, etag: string, accountId?: string) => {
    let url = `/file/${fileId}/move`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<FileModel>(url, { method: "POST", etag, body: JSON.stringify({ destination_folder_id: destinationFolderId }) });
  },

  copy: (fileId: string, destinationFolderId: string, newName?: string, accountId?: string) => {
    let url = `/file/${fileId}/copy`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<FileModel>(url, { method: "POST", body: JSON.stringify({ destination_folder_id: destinationFolderId, name: newName }) });
  },

  download: (fileId: string, accountId?: string) => {
    let url = `${API_BASE}/file/${fileId}/download?token=${getToken()}`;
    if (accountId) url += `&account_id=${accountId}`;
    return url;
  },

  share: (fileId: string, accountId?: string) => {
    let url = `/file/${fileId}/share`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ share_url: string }>(url, { method: "POST" });
  },

  preview: (fileId: string, accountId?: string) => {
    let url = `/preview/${fileId}`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ preview_url: string }>(url);
  },

  bulkDelete: (fileIds: string[], etags: Record<string, string>, accountId?: string) => {
    let url = "/files/bulk/delete";
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ success: string[]; failed: any[] }>(url, { method: "POST", body: JSON.stringify({ file_ids: fileIds, etags }) });
  },

  bulkMove: (fileIds: string[], destinationFolderId: string, etags: Record<string, string>, accountId?: string) => {
    let url = "/files/bulk/move";
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ success: string[]; failed: any[] }>(url, { method: "POST", body: JSON.stringify({ file_ids: fileIds, destination_folder_id: destinationFolderId, etags }) });
  },

  recent: (pageToken?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (accountId) params.set("account_id", accountId);
    const qs = params.toString();
    return apiFetch<FileList>(`/recent${qs ? "?" + qs : ""}`);
  },

  starred: (pageToken?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (accountId) params.set("account_id", accountId);
    const qs = params.toString();
    return apiFetch<FileList>(`/starred${qs ? "?" + qs : ""}`);
  },

  sharedWithMe: (pageToken?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (accountId) params.set("account_id", accountId);
    const qs = params.toString();
    return apiFetch<FileList>(`/shared-with-me${qs ? "?" + qs : ""}`);
  },

  trash: (pageToken?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (accountId) params.set("account_id", accountId);
    const qs = params.toString();
    return apiFetch<FileList>(`/trash${qs ? "?" + qs : ""}`);
  },

  star: (fileId: string, starred: boolean, accountId?: string) => {
    let url = `/file/${fileId}/star`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ success: boolean }>(url, { method: "POST", body: JSON.stringify({ starred }) });
  },

  restore: (fileId: string, etag: string, accountId?: string) => {
    let url = `/file/${fileId}/restore`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<FileModel>(url, { method: "POST", etag });
  },

  emptyTrash: (accountId?: string) => {
    let url = "/trash/empty";
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<{ success: boolean }>(url, { method: "POST" });
  },

  storageQuota: (accountId?: string) => {
    let url = "/storage/quota";
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<any>(url);
  },

  sharedDrives: (pageToken?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (accountId) params.set("account_id", accountId);
    const qs = params.toString();
    return apiFetch<FileList>(`/shared-drives${qs ? "?" + qs : ""}`);
  },

  fileMetadata: (fileId: string, accountId?: string) => {
    let url = `/file/${fileId}/metadata`;
    if (accountId) url += `?account_id=${accountId}`;
    return apiFetch<any>(url);
  },

  transfer: (data: {
    source_account_id: string;
    destination_account_id: string;
    file_id: string;
    destination_folder_id?: string;
    new_name?: string;
    move?: boolean;
  }) => apiFetch<{ transfer_id: string; status: string }>("/transfer/cross-account", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  transferStatus: (transferId: string) =>
    apiFetch<any>(`/transfer/${transferId}/status`),
};

// ── SSE ───────────────────────────────────────────────────────────────────────

export function createEventSource(onEvent: (e: { type: string; folder_id?: string }) => void): EventSource {
  const token = getToken();
  if (!token) {
    console.warn("No token available for SSE connection");
    return { close: () => {} } as EventSource;
  }
  const url = `${API_BASE}/events?token=${token}`;
  const es = new EventSource(url, { withCredentials: false });
  es.onopen = () => console.log("SSE connected");
  es.onmessage = (event) => {
    try { onEvent(JSON.parse(event.data)); }
    catch (e) { console.error("SSE parse error:", e); }
  };
  es.onerror = (err) => console.error("SSE error:", err);
  return es;
}
