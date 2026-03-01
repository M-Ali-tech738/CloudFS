import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { auth, files, createEventSource, CloudFSApiError } from "@/lib/api";
import type { FileList, FileModel, UserInfo } from "@/types";

// ── useUser ───────────────────────────────────────────────────────────────────

export function useUser() {
  const { data, error, isLoading } = useSWR<UserInfo, CloudFSApiError>(
    "/auth/me",
    () => {
      console.log("Fetching /auth/me...");
      return auth.me();
    },
    {
      revalidateOnFocus: false,
      onSuccess: (data) => console.log("/auth/me success:", data),
      onError: (err) => console.error("/auth/me error:", err),
    }
  );

  console.log("useUser state:", { data, error, isLoading });

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
    () => {
      console.log(`Fetching files for folder: ${folderId}`);
      return files.list(folderId);
    },
    {
      revalidateOnFocus: false,
      onSuccess: (data) => console.log(`Files loaded for ${folderId}:`, data),
      onError: (err) => console.error(`Files error for ${folderId}:`, err),
    }
  );

  const deleteFile = async (file: FileModel) => {
    try {
      console.log(`Deleting file: ${file.id}`);
      await files.delete(file.id, file.etag);
      await revalidate();
    } catch (err) {
      if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
        throw err;
      }
      throw err;
    }
  };

  const renameFile = async (file: FileModel, newName: string) => {
    try {
      console.log(`Renaming file ${file.id} to: ${newName}`);
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
  };

  const uploadFile = async (file: File) => {
    console.log(`Uploading file: ${file.name} to folder: ${folderId}`);
    await files.upload(file, folderId);
    await revalidate();
  };

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
  useEffect(() => {
    console.log(`Setting up SSE for folder: ${currentFolderId}`);

    const es = createEventSource((event) => {
      console.log("SSE event received:", event);
      if (event.type === "change" && event.folder_id === currentFolderId) {
        console.log(`Refreshing folder: ${currentFolderId}`);
        mutate(`/files/${currentFolderId}`);
      }
    });

    es.onopen = () => console.log("SSE connection opened");
    es.onerror = (err) => console.error("SSE error:", err);

    return () => {
      console.log("Closing SSE connection");
      es.close();
    };
  }, [currentFolderId]);
}

// ── useKeyboardNav ─────────────────────────────────────────────────────────────

export function useKeyboardNav(
  items: FileModel[],
  selectedIndex: number,
  setSelectedIndex: (i: number) => void,
  onOpen: (file: FileModel) => void
) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (items.length === 0) return;

      console.log("Keyboard event:", e.key);

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
