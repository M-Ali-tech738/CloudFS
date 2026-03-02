import { useEffect, useRef, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { auth, files, createEventSource, CloudFSApiError } from "@/lib/api";
import type { FileList, FileModel, UserInfo } from "@/types";

// ── Token management ──────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cloudfs_token=([^;]+)/);
  return match ? match[1] : null;
}

function setToken(token: string) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  document.cookie = [
    `cloudfs_token=${token}`,
    `path=/`,
    `max-age=${maxAge}`,
    `SameSite=Strict`,
    window.location.protocol === "https:" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearToken() {
  document.cookie = "cloudfs_token=; path=/; max-age=0";
}

// ── Silent refresh ────────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const token = getToken();
      if (!token) return false;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://cloudfs.onrender.com"}/auth/refresh`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) return false;

      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── useUser ───────────────────────────────────────────────────────────────────

export function useUser() {
  const { data, error, isLoading, mutate: revalidateUser } = useSWR<UserInfo, CloudFSApiError>(
    "/auth/me",
    () => auth.me(),
    {
      revalidateOnFocus: false,
      onError: async (err: CloudFSApiError) => {
        // On token expiry — try silent refresh then retry
        if (err?.code === "AUTH_TOKEN_EXPIRED" || err?.code === "AUTH_TOKEN_INVALID") {
          const refreshed = await silentRefresh();
          if (refreshed) {
            // Refresh succeeded — revalidate user and all data
            await revalidateUser();
            await mutate(() => true, undefined, { revalidate: true });
          } else {
            // Refresh failed — clear token, user will see login page
            clearToken();
          }
        }
      },
    }
  );

  const isUnauthenticated =
    !isLoading &&
    !data &&
    (error?.code === "AUTH_TOKEN_INVALID" ||
      error?.code === "AUTH_TOKEN_EXPIRED" ||
      error?.code === "AUTH_GOOGLE_REVOKED");

  return { user: data, isLoading, isUnauthenticated, error };
}

// ── useFiles ──────────────────────────────────────────────────────────────────

export function useFiles(folderId = "root") {
  const cacheKey = `/files/${folderId}`;
  const { data, error, isLoading, mutate: revalidate } = useSWR<FileList, CloudFSApiError>(
    cacheKey,
    () => files.list(folderId),
    { revalidateOnFocus: false }
  );

  const deleteFile = useCallback(
    async (file: FileModel) => {
      try {
        await files.delete(file.id, file.etag);
        await revalidate();
      } catch (err) {
        throw err;
      }
    },
    [revalidate]
  );

  const renameFile = useCallback(
    async (file: FileModel, newName: string) => {
      try {
        await files.rename(file.id, newName, file.etag);
        await revalidate();
      } catch (err) {
        if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
          const fresh = await files.get(file.id);
          await files.rename(fresh.id, newName, fresh.etag);
          await revalidate();
        } else {
          throw err;
        }
      }
    },
    [revalidate]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      await files.upload(file, folderId);
      await revalidate();
    },
    [folderId, revalidate]
  );

  return {
    files: data?.files ?? [],
    nextPageToken: data?.next_page_token,
    isLoading,
    error,
    deleteFile,
    renameFile,
    uploadFile,
    revalidate,
  };
}

// ── useSSE ────────────────────────────────────────────────────────────────────

export function useSSE(currentFolderId: string) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = createEventSource((event) => {
      if (event.type === "change" && event.folder_id === currentFolderId) {
        mutate(`/files/${currentFolderId}`);
      }
    });
    esRef.current = es;
    return () => { es.close(); };
  }, [currentFolderId]);
}

// ── useKeyboardNav ────────────────────────────────────────────────────────────

export function useKeyboardNav(
  items: FileModel[],
  selectedIndex: number,
  setSelectedIndex: (i: number) => void,
  onOpen: (file: FileModel) => void
) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        onOpen(items[selectedIndex]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items, selectedIndex, setSelectedIndex, onOpen]);
}
