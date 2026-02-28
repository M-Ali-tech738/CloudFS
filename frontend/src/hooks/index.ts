import { useEffect, useRef, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { auth, files, createEventSource, CloudFSApiError } from "@/lib/api";
import type { FileList, FileModel, UserInfo } from "@/types";

// ── useUser ───────────────────────────────────────────────────────────────────

export function useUser() {
  const { data, error, isLoading } = useSWR<UserInfo, CloudFSApiError>(
    "/auth/me",
    () => auth.me(),
    { revalidateOnFocus: false }
  );

  const isUnauthenticated =
    error?.code === "AUTH_TOKEN_INVALID" ||
    error?.code === "AUTH_TOKEN_EXPIRED" ||
    error?.code === "AUTH_GOOGLE_REVOKED";

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
        if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
          // Spec §7: Abort and notify user
          throw err;
        }
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
          // Spec §7: Last-write-wins for renames — re-fetch and retry
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

// ── useSSE — real-time change notifications ────────────────────────────────────

export function useSSE(currentFolderId: string) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = createEventSource((event) => {
      if (event.type === "change" && event.folder_id === currentFolderId) {
        // Soft-refresh the current folder listing
        mutate(`/files/${currentFolderId}`);
      }
    });
    esRef.current = es;

    return () => {
      es.close();
    };
  }, [currentFolderId]);
}

// ── useUploadDrop ─────────────────────────────────────────────────────────────

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
