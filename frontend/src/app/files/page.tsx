"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  File,
  Upload,
  Trash2,
  Pencil,
  ExternalLink,
  ArrowLeft,
  LogOut,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import { useUser, useFiles, useSSE, useKeyboardNav } from "@/hooks";
import { auth, files as filesApi, CloudFSApiError } from "@/lib/api";
import type { FileModel } from "@/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FilesPage() {
  const router = useRouter();
  const { user, isLoading: userLoading, isUnauthenticated, error: userError } = useUser();
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "My Drive" },
  ]);
  const currentFolder = folderStack[folderStack.length - 1];

  // Add debugging
  console.log("FilesPage render:", { user, userLoading, isUnauthenticated, userError });

  const { files, isLoading, error, deleteFile, renameFile, uploadFile, revalidate } =
    useFiles(currentFolder.id);

  useSSE(currentFolder.id);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [renameState, setRenameState] = useState<{ file: FileModel; value: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "warn" } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    console.log("Auth check:", { isUnauthenticated, userLoading, user });

    if (!userLoading && isUnauthenticated) {
      console.log("Redirecting to login...");
      window.location.href = "/";
    }
  }, [isUnauthenticated, userLoading, user, router]);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "warn" = "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const openFile = useCallback(
    (file: FileModel) => {
      if (file.type === "folder") {
        setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
        setSelectedIndex(-1);
      } else if (file.web_view_link) {
        window.open(file.web_view_link, "_blank");
      }
    },
    []
  );

  useKeyboardNav(files, selectedIndex, setSelectedIndex, openFile);

  const handleDelete = useCallback(
    async (file: FileModel) => {
      try {
        await deleteFile(file);
        showToast(`"${file.name}" deleted`, "success");
      } catch (err) {
        if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
          showToast(
            `"${file.name}" was modified on another device. Refresh and try again.`,
            "warn"
          );
        } else {
          showToast((err as Error).message);
        }
      }
    },
    [deleteFile, showToast]
  );

  const handleRenameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!renameState) return;
      const { file, value } = renameState;
      setRenameState(null);
      try {
        await renameFile(file, value);
        showToast(`Renamed to "${value}"`, "success");
      } catch (err) {
        showToast((err as Error).message);
      }
    },
    [renameState, renameFile, showToast]
  );

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      for (const file of Array.from(fileList)) {
        try {
          await uploadFile(file);
          showToast(`Uploaded "${file.name}"`, "success");
        } catch (err) {
          if (err instanceof CloudFSApiError) {
            showToast(err.message, "error");
          } else {
            showToast(`Upload failed: ${file.name}`);
          }
        }
      }
    },
    [uploadFile, showToast]
  );

  const handleLogout = async () => {
  await auth.logout();
  window.location.href = "/"; // hard redirect, not router.push
};

  // Show loading state while checking authentication
  if (userLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-3 border-accent/40 border-t-accent animate-spin" />
          <p className="text-text-muted text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 15a4 4 0 004 4h10a3 3 0 000-6 5 5 0 00-9.9-1A4 4 0 003 15z"
                stroke="#4ade80"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-mono text-sm font-semibold text-text-primary">CloudFS</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          {folderStack.map((folder, i) => (
            <div key={folder.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-text-muted text-sm">/</span>}
              <button
                onClick={() => setFolderStack((s) => s.slice(0, i + 1))}
                className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                  i === folderStack.length - 1
                    ? "text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => revalidate()}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
            title="Refresh (r)"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-muted border border-accent/30
              text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            <Upload size={14} />
            Upload
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          <div className="w-px h-5 bg-border mx-1" />

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-text-secondary hover:text-danger transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Column headers */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex items-center gap-3 px-3 py-1 text-xs font-mono text-text-muted uppercase tracking-wider">
          <span className="flex-1">Name</span>
          <span className="w-24 text-right hidden sm:block">Modified</span>
          <span className="w-20 text-right hidden sm:block">Size</span>
          <span className="w-16" />
        </div>
      </div>

      {/* File list */}
      <main className="flex-1 px-4 pb-8">
        {/* Back button */}
        {folderStack.length > 1 && (
          <button
            onClick={() => setFolderStack((s) => s.slice(0, -1))}
            className="file-row w-full text-text-secondary hover:text-text-primary mb-1"
          >
            <ArrowLeft size={16} />
            <span className="font-mono text-sm">..</span>
          </button>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 px-3 py-6 text-text-muted text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            Loading files...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-4 text-danger text-sm bg-danger/10 rounded-lg border border-danger/20 mt-2">
            <AlertTriangle size={15} />
            {error.message} (Code: {error.code})
          </div>
        )}

        {!isLoading && !error && files.length === 0 && (
          <div className="px-3 py-12 text-center text-text-muted text-sm">
            This folder is empty. Click Upload to add files.
          </div>
        )}

        {files.map((file, index) => (
          <div
            key={file.id}
            className={`file-row w-full group ${selectedIndex === index ? "selected" : ""}`}
            onClick={() => {
              setSelectedIndex(index);
              if (selectedIndex === index) openFile(file);
            }}
            onDoubleClick={() => openFile(file)}
            tabIndex={0}
            role="row"
          >
            {/* Icon */}
            {file.type === "folder" ? (
              <Folder size={16} className="text-accent shrink-0" />
            ) : (
              <File size={16} className="text-text-secondary shrink-0" />
            )}

            {/* Name */}
            <div className="flex-1 min-w-0">
              {renameState?.file.id === file.id ? (
                <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    className="bg-surface-3 border border-accent/50 rounded px-2 py-0.5 text-sm
                      text-text-primary font-mono w-full outline-none focus:border-accent"
                    value={renameState.value}
                    onChange={(e) =>
                      setRenameState((s) => s && { ...s, value: e.target.value })
                    }
                    onBlur={() => setRenameState(null)}
                    onKeyDown={(e) => e.key === "Escape" && setRenameState(null)}
                  />
                </form>
              ) : (
                <span className="font-mono text-sm truncate block">{file.name}</span>
              )}
            </div>

            {/* Modified */}
            <span className="text-xs text-text-muted w-24 text-right hidden sm:block shrink-0">
              {formatDate(file.modified_at)}
            </span>

            {/* Size */}
            <span className="text-xs text-text-muted w-20 text-right hidden sm:block shrink-0 font-mono">
              {formatBytes(file.size)}
            </span>

            {/* Row actions */}
            <div
              className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100
                transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setRenameState({ file, value: file.name })}
                className="p-1.5 rounded hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
                title="Rename"
              >
                <Pencil size={13} />
              </button>
              {file.web_view_link && (
                <button
                  onClick={() => window.open(file.web_view_link!, "_blank")}
                  className="p-1.5 rounded hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
                  title="Open in Drive"
                >
                  <ExternalLink size={13} />
                </button>
              )}
              <button
                onClick={() => handleDelete(file)}
                className="p-1.5 rounded hover:bg-danger/15 text-text-muted hover:text-danger transition-colors"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Status bar */}
      <footer className="sticky bottom-0 border-t border-border bg-surface/90 backdrop-blur px-4 py-2
        flex items-center justify-between text-xs font-mono text-text-muted">
        <span>
          {files.length} item{files.length !== 1 ? "s" : ""} · {currentFolder.name}
        </span>
        <span>{user?.email || 'Not signed in'}</span>
      </footer>

      {/* Toast notifications */}
      {toast && (
        <div
          className={`fixed bottom-14 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm
            shadow-xl border font-medium transition-all z-50
            ${
              toast.type === "success"
                ? "bg-accent-muted border-accent/30 text-accent"
                : toast.type === "warn"
                ? "bg-warn/10 border-warn/30 text-warn"
                : "bg-danger/10 border-danger/30 text-danger"
            }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
