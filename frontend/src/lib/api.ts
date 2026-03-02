/**
 * API client — all backend communication.
 */
import type { FileList, FileModel, UploadResult, ApiError, UserInfo, ErrorCode } from "@/types";

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

export const auth = {
  loginUrl: () => `${API_BASE}/auth/google/login`,
  me: () => apiFetch<UserInfo>("/auth/me"),
  logout: async () => {
    try { await apiFetch<void>("/auth/logout", { method: "POST" }); } finally { clearToken(); }
  },
};

export const files = {
  list: (folderId = "root", pageToken?: string) =>
    withRetry(() => apiFetch<FileList>(`/files?folder_id=${folderId}${pageToken ? `&page_token=${pageToken}` : ""}`), "STORAGE_RATE_LIMITED"),
  get: (fileId: string) => withRetry(() => apiFetch<FileModel>(`/file/${fileId}`), "STORAGE_PROVIDER_ERROR"),
  search: (q: string, pageToken?: string) =>
    apiFetch<FileList>(`/search?q=${encodeURIComponent(q)}${pageToken ? `&page_token=${pageToken}` : ""}`),
  upload: (file: File, folderId = "root") => {
    const form = new FormData();
    form.append("file", file);
    return withRetry(() => apiFetch<UploadResult>(`/upload?folder_id=${folderId}`, { method: "POST", body: form }), "STORAGE_RATE_LIMITED");
  },
  createFolder: (name: string, parentFolderId = "root") =>
    apiFetch<FileModel>(`/folder?folder_id=${parentFolderId}`, { method: "POST", body: JSON.stringify({ name }) }),
  delete: (fileId: string, etag: string) => apiFetch<void>(`/file/${fileId}`, { method: "DELETE", etag }),
  rename: (fileId: string, newName: string, etag: string) =>
    withRetry(() => apiFetch<FileModel>(`/file/${fileId}`, { method: "PATCH", etag, body: JSON.stringify({ name: newName }) }), "STORAGE_PROVIDER_ERROR"),
  move: (fileId: string, destinationFolderId: string, etag: string) =>
    apiFetch<FileModel>(`/file/${fileId}/move`, { method: "POST", etag, body: JSON.stringify({ destination_folder_id: destinationFolderId }) }),
  copy: (fileId: string, destinationFolderId: string, newName?: string) =>
    apiFetch<FileModel>(`/file/${fileId}/copy`, { method: "POST", body: JSON.stringify({ destination_folder_id: destinationFolderId, name: newName }) }),
  download: (fileId: string) => `${API_BASE}/file/${fileId}/download?token=${getToken()}`,
  share: (fileId: string) => apiFetch<{ share_url: string }>(`/file/${fileId}/share`, { method: "POST" }),
  preview: (fileId: string) => apiFetch<{ preview_url: string }>(`/preview/${fileId}`),
  bulkDelete: (fileIds: string[], etags: Record<string, string>) =>
    apiFetch<{ success: string[]; failed: any[] }>("/files/bulk/delete", { method: "POST", body: JSON.stringify({ file_ids: fileIds, etags }) }),
  bulkMove: (fileIds: string[], destinationFolderId: string, etags: Record<string, string>) =>
    apiFetch<{ success: string[]; failed: any[] }>("/files/bulk/move", { method: "POST", body: JSON.stringify({ file_ids: fileIds, destination_folder_id: destinationFolderId, etags }) }),
};

export function createEventSource(onEvent: (e: { type: string; folder_id?: string }) => void): EventSource {
  const token = getToken();
  const url = `${API_BASE}/events${token ? `?token=${token}` : ""}`;
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (event) => { try { onEvent(JSON.parse(event.data)); } catch {} };
  return es;
}
