"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronRight, LogOut, Grid3x3, List, Menu } from "lucide-react";

import { auth, files as filesApi, accounts as accountsApi } from "@/lib/api";
import type { FileModel, NavSection, ConnectedAccount, StorageQuota, TransferStatus } from "@/types";
import { formatBytes } from "@/lib/utils";

import { useUser } from "@/hooks/useUser";
import { useFiles } from "@/hooks/useFiles";
import { useSearch } from "@/hooks/useSearch";
import { useSelection } from "@/hooks/useSelection";
import { usePreview } from "@/hooks/usePreview";
import { useSSE, useKeyboardNav } from "@/hooks/useSSE";

import { Sidebar } from "@/components/layout/Sidebar";
import { FileRow } from "@/components/files/FileRow";
import { FileToolbar } from "@/components/files/FileToolbar";
import { FilePreview } from "@/components/files/FilePreview";
import { FolderPicker } from "@/components/files/FolderPicker";
import { SearchBar } from "@/components/files/SearchBar";
import { BulkActions } from "@/components/files/BulkActions";
import { TransferModal } from "@/components/files/TransferModal";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

type ToastState = { message: string; type: "success" | "error" | "warn" } | null;
type ModalType =
  | "rename" | "createFolder" | "move" | "copy"
  | "share" | "confirmDelete" | "bulkMove" | "bulkDelete"
  | "transfer" | null;
type SortKey = "name" | "modified" | "size" | "type";
type ViewMode = "list" | "grid";

function sortFiles(fileList: FileModel[], sortBy: SortKey): FileModel[] {
  return [...fileList].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    switch (sortBy) {
      case "name":     return a.name.localeCompare(b.name);
      case "modified": return new Date(b.modified_at as any).getTime() - new Date(a.modified_at as any).getTime();
      case "size":     return (b.size || 0) - (a.size || 0);
      case "type":     return (a.mime_type || "").localeCompare(b.mime_type || "");
      default:         return 0;
    }
  });
}

const INPUT_CLS   = "w-full rounded px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors";
const INPUT_STYLE = { background: "var(--bg-2)", border: "1px solid var(--border)" };
const BTN_CANCEL  = "flex-1 py-2 rounded text-sm text-text-secondary transition-colors";
const BTN_CANCEL_STYLE  = { background: "var(--bg-2)", border: "1px solid var(--border)" };
const BTN_PRIMARY = "flex-1 py-2 rounded text-sm font-medium transition-all disabled:opacity-40";
const BTN_PRIMARY_STYLE = { background: "rgba(99,211,135,0.15)", border: "1px solid rgba(99,211,135,0.3)", color: "#63d387" };
const BTN_DANGER  = "flex-1 py-2 rounded text-sm font-medium transition-all disabled:opacity-40";
const BTN_DANGER_STYLE  = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" };

export default function FilesPage() {
  const { user, isLoading: userLoading, isUnauthenticated } = useUser();

  // ── State ──────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>("my-drive");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
  const [sharedDrives, setSharedDrives] = useState<{ id: string; name: string }[]>([]);

  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(null);

  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "My Drive" },
  ]);
  const currentFolder = folderStack[folderStack.length - 1];

  const { files, isLoading, error, deleteFile, renameFile, moveFile, copyFile, uploadFile, createFolder, shareFile, bulkDelete, bulkMove, revalidate } =
    useFiles(activeSection === "my-drive" ? currentFolder.id : undefined, activeAccountId || undefined);

  const [sortBy, setSortBy]       = useState<SortKey>("name");
  const sortedFiles                = useMemo(() => sortFiles(files, sortBy), [files, sortBy]);

  const { selectedIds, selectedFiles, hasSelection, isSelectMode, toggleSelect, selectAll, clearSelection, onLongPressStart, onLongPressEnd } = useSelection(sortedFiles);
  const { previewFile, openPreview, closePreview } = usePreview();
  const { query, setQuery, results, isSearching, isOpen: isSearchOpen, openSearch, closeSearch } = useSearch();

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeModal, setActiveModal]     = useState<ModalType>(null);
  const [targetFile, setTargetFile]       = useState<FileModel | null>(null);
  const [inputValue, setInputValue]       = useState("");
  const [pickerFolderId, setPickerFolderId]   = useState<string | null>(null);
  const [pickerFolderName, setPickerFolderName] = useState("");
  const [shareUrl, setShareUrl]           = useState("");
  const [isProcessing, setIsProcessing]   = useState(false);
  const [toast, setToast]                 = useState<ToastState>(null);

  // ── Load accounts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setAccountsLoading(true);
    accountsApi.list()
      .then((data) => {
        setAccounts(data);
        if (data.length > 0) setActiveAccountId(data.find((a) => a.is_primary)?.id ?? data[0].id);
      })
      .catch(console.error)
      .finally(() => setAccountsLoading(false));
  }, [user]);

  // Handle ?connected=1 query param (after add-account OAuth)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connected") === "1") {
      window.history.replaceState({}, "", "/files");
      showToast("New account connected!", "success");
      accountsApi.list().then(setAccounts).catch(console.error);
    }
    if (sp.get("error") === "no_refresh_token") {
      window.history.replaceState({}, "", "/files");
      showToast("Could not connect account — please try again", "error");
    }
  }, []);

  // ── Load storage quota ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeAccountId) return;
    filesApi.storageQuota(activeAccountId)
      .then((q) => setStorageQuota(q))
      .catch(console.error);
  }, [activeAccountId]);

  // ── Load shared drives for sidebar ─────────────────────────────────────────
  useEffect(() => {
    if (!activeAccountId) return;
    filesApi.sharedDrives(undefined, activeAccountId)
      .then((result) => setSharedDrives(result.files.map((f) => ({ id: f.id, name: f.name }))))
      .catch(() => setSharedDrives([]));
  }, [activeAccountId]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error" | "warn") => {
    setToast({ message, type });
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setTargetFile(null);
    setInputValue("");
    setPickerFolderId(null);
    setPickerFolderName("");
    setShareUrl("");
    setIsProcessing(false);
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setIsProcessing(true);
    try { await fn(); }
    catch (e: any) { showToast(e?.message || "Something went wrong", "error"); }
    finally { setIsProcessing(false); }
  }, [showToast]);

  const openFolder = useCallback((file: FileModel) => {
    if (file.type === "folder") {
      setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
      setSelectedIndex(-1);
      closePreview();
    }
  }, [closePreview]);

  useKeyboardNav(sortedFiles, selectedIndex, setSelectedIndex, openFolder);
  useSSE(currentFolder.id);

  // ── File actions ───────────────────────────────────────────────────────────
  const handleSingleClick = useCallback((file: FileModel) => {
    setSelectedIndex(sortedFiles.indexOf(file));
    openPreview(file);
  }, [sortedFiles, openPreview]);

  const handleDoubleClick = useCallback((file: FileModel) => {
    if (file.type === "folder") openFolder(file);
  }, [openFolder]);

  const handleDownload = useCallback((file: FileModel) => {
    window.open(filesApi.download(file.id, activeAccountId || undefined), "_blank");
  }, [activeAccountId]);

  const handleShare = useCallback(async (file: FileModel) => {
    setTargetFile(file);
    setActiveModal("share");
    setIsProcessing(true);
    try {
      const { share_url } = await shareFile(file);
      setShareUrl(share_url);
    } catch {
      showToast("Failed to get share link", "error");
      closeModal();
    } finally {
      setIsProcessing(false);
    }
  }, [shareFile, showToast, closeModal]);

  const handleSearchSelect = useCallback((file: FileModel) => {
    closeSearch();
    openPreview(file);
  }, [closeSearch, openPreview]);

  // ── Cross-account transfer ─────────────────────────────────────────────────
  const handleCrossAccountTransfer = useCallback(async (data: {
    sourceAccountId: string;
    destAccountId: string;
    fileId: string;
    destFolderId: string;
    newName?: string;
    move: boolean;
  }) => {
    const result = await filesApi.transfer({
      source_account_id: data.sourceAccountId,
      destination_account_id: data.destAccountId,
      file_id: data.fileId,
      destination_folder_id: data.destFolderId,
      new_name: data.newName,
      move: data.move,
    });
    setTransferStatus({ transfer_id: result.transfer_id, status: "in_progress", progress: 0 });
    // Poll for status
    const poll = setInterval(async () => {
      try {
        const status = await filesApi.transferStatus(result.transfer_id);
        setTransferStatus(status);
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(poll);
          if (status.status === "completed") {
            showToast(data.move ? "File moved successfully" : "File copied successfully", "success");
          } else {
            showToast("Transfer failed", "error");
          }
        }
      } catch { clearInterval(poll); }
    }, 2000);
  }, [showToast]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((section: NavSection, folderId?: string) => {
    setActiveSection(section);
    if (section === "my-drive") {
      if (folderId) {
        setFolderStack([{ id: "root", name: "My Drive" }, { id: folderId, name: folderId }]);
      } else {
        setFolderStack([{ id: "root", name: "My Drive" }]);
      }
    }
    closePreview();
    clearSelection();
    setSidebarOpen(false);
  }, [closePreview, clearSelection]);

  const handleAddAccount = useCallback(() => {
    window.location.href = accountsApi.connectUrl();
  }, []);

  const handleDisconnectAccount = useCallback(async (accountId: string) => {
    try {
      await accountsApi.disconnect(accountId);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      if (activeAccountId === accountId) {
        const remaining = accounts.filter((a) => a.id !== accountId);
        setActiveAccountId(remaining[0]?.id ?? null);
      }
      showToast("Account disconnected", "success");
    } catch {
      showToast("Failed to disconnect account", "error");
    }
  }, [accounts, activeAccountId, showToast]);

  const handleLogout = useCallback(async () => {
    await auth.logout();
    window.location.href = "/";
  }, []);

  // ── Redirect if unauthenticated ────────────────────────────────────────────
  useEffect(() => {
    if (isUnauthenticated) window.location.href = "/";
  }, [isUnauthenticated]);

  if (userLoading || accountsLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg)" }}>
        <Spinner size={24} />
      </div>
    );
  }

  // Build My Drive top-level folders from current file list
  const myDriveFolders = activeSection === "my-drive" && currentFolder.id === "root"
    ? sortedFiles.filter((f) => f.type === "folder").map((f) => ({ id: f.id, name: f.name }))
    : [];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--text-1)" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="hidden md:flex">
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSwitchAccount={setActiveAccountId}
          onAddAccount={handleAddAccount}
          onDisconnectAccount={handleDisconnectAccount}
          storageQuota={storageQuota}
          myDriveFolders={myDriveFolders}
          sharedDrives={sharedDrives}
        />
      </div>

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <Sidebar
          isMobile
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeSection={activeSection}
          onNavigate={handleNavigate}
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSwitchAccount={setActiveAccountId}
          onAddAccount={handleAddAccount}
          onDisconnectAccount={handleDisconnectAccount}
          storageQuota={storageQuota}
          myDriveFolders={myDriveFolders}
          sharedDrives={sharedDrives}
        />
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="flex items-center gap-3 px-4 h-12 shrink-0"
          style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--border)" }}
        >
          {/* Mobile hamburger */}
          <button className="md:hidden p-1 rounded hover:bg-white/5" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} style={{ color: "var(--text-3)" }} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-1 min-w-0 text-xs" style={{ color: "var(--text-3)" }}>
            {activeSection === "my-drive" ? (
              folderStack.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  <button
                    onClick={() => setFolderStack((s) => s.slice(0, i + 1))}
                    className="hover:text-text-primary transition-colors truncate max-w-32"
                    style={{ color: i === folderStack.length - 1 ? "var(--text-1)" : "var(--text-3)" }}
                  >
                    {f.name}
                  </button>
                </span>
              ))
            ) : (
              <span style={{ color: "var(--text-1)" }}>
                {{ home: "Home", recent: "Recent", starred: "Starred", shared: "Shared with me", trash: "Trash", drives: "Shared Drives", storage: "Storage", computers: "Computers", "my-drive": "My Drive" }[activeSection]}
              </span>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded p-0.5" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
            {(["list", "grid"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-1 rounded transition-colors"
                style={{ background: viewMode === mode ? "var(--bg-3)" : "transparent", color: viewMode === mode ? "var(--text-1)" : "var(--text-3)" }}
              >
                {mode === "list" ? <List size={14} /> : <Grid3x3 size={14} />}
              </button>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            title="Sign out"
          >
            <LogOut size={15} style={{ color: "var(--text-3)" }} />
          </button>
        </header>

        {/* Toolbar */}
        <FileToolbar
          onUpload={uploadFile}
          onCreateFolder={() => { setActiveModal("createFolder"); setInputValue(""); }}
          onSearch={openSearch}
          sortBy={sortBy}
          onSortChange={(s) => setSortBy(s as SortKey)}
          onRefresh={revalidate}
          isLoading={isLoading}
        />

        {/* Bulk actions bar */}
        {isSelectMode && hasSelection && (
          <BulkActions
            selectedFiles={selectedFiles}
            allFiles={sortedFiles}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onBulkDelete={() => setActiveModal("bulkDelete")}
            onBulkMove={() => setActiveModal("bulkMove")}
          />
        )}

        {/* File list + preview */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size={20} />
              </div>
            ) : sortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm" style={{ color: "var(--text-3)" }}>No files here</p>
              </div>
            ) : (
              <div className="p-2">
                {sortedFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    isSelected={sortedFiles[selectedIndex]?.id === file.id}
                    isChecked={selectedIds.has(file.id)}
                    isSelectMode={isSelectMode}
                    onSingleClick={handleSingleClick}
                    onDoubleClick={handleDoubleClick}
                    onLongPressStart={onLongPressStart}
                    onLongPressEnd={onLongPressEnd}
                    onToggleCheck={toggleSelect}
                    onRename={(f) => { setTargetFile(f); setInputValue(f.name); setActiveModal("rename"); }}
                    onDelete={(f) => { setTargetFile(f); setActiveModal("confirmDelete"); }}
                    onMove={(f) => { setTargetFile(f); setPickerFolderId(null); setActiveModal("move"); }}
                    onCopy={(f) => { setTargetFile(f); setPickerFolderId(null); setActiveModal("copy"); }}
                    onDownload={handleDownload}
                    onShare={handleShare}
                    onPreview={openPreview}
                    onTransfer={(f) => { setTargetFile(f); setActiveModal("transfer"); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Preview panel */}
          {previewFile && (
            <FilePreview
              file={previewFile}
              onClose={closePreview}
              onDownload={handleDownload}
              
            />
          )}
        </div>

        {/* Status bar */}
        <div
          className="flex items-center px-4 h-7 text-xs shrink-0"
          style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border)", color: "var(--text-3)" }}
        >
          {sortedFiles.length} items
          {hasSelection && ` · ${selectedFiles.length} selected`}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {activeModal === "rename" && (
        <Modal title="Rename" onClose={closeModal} isOpen>
          <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(async () => { await renameFile(targetFile!, inputValue.trim()); showToast("Renamed", "success"); closeModal(); })}
            placeholder="New name" className={INPUT_CLS} style={INPUT_STYLE}
            onFocus={(e) => { e.target.style.borderColor = "rgba(99,211,135,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
          />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await renameFile(targetFile!, inputValue.trim()); showToast("Renamed", "success"); closeModal(); })}
              disabled={isProcessing || !inputValue.trim()} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Renaming…" : "Rename"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "createFolder" && (
        <Modal title="New Folder" onClose={closeModal} isOpen>
          <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(async () => { await createFolder(inputValue.trim()); showToast("Folder created", "success"); closeModal(); })}
            placeholder="Folder name" className={INPUT_CLS} style={INPUT_STYLE}
            onFocus={(e) => { e.target.style.borderColor = "rgba(99,211,135,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
          />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await createFolder(inputValue.trim()); showToast("Folder created", "success"); closeModal(); })}
              disabled={isProcessing || !inputValue.trim()} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Creating…" : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "confirmDelete" && (
        <Modal title="Delete file" onClose={closeModal} isOpen>
          <p className="text-sm text-text-secondary mb-4">
            Delete <strong className="text-text-primary">"{targetFile?.name}"</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await deleteFile(targetFile!); showToast("Deleted", "success"); closeModal(); if (previewFile?.id === targetFile?.id) closePreview(); })}
              disabled={isProcessing} className={BTN_DANGER} style={BTN_DANGER_STYLE}>
              {isProcessing ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "move" && (
        <Modal title="Move to…" onClose={closeModal} width="max-w-sm" isOpen>
          <p className="text-xs text-text-muted mb-3">Moving: <span className="text-text-secondary">{targetFile?.name}</span></p>
          <FolderPicker accountId={activeAccountId} selectedId={pickerFolderId}
            onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }}
            excludeId={targetFile?.id} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await moveFile(targetFile!, pickerFolderId!); showToast(`Moved to ${pickerFolderName}`, "success"); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Moving…" : "Move here"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "copy" && (
        <Modal title="Copy to…" onClose={closeModal} width="max-w-sm" isOpen>
          <p className="text-xs text-text-muted mb-3">Copying: <span className="text-text-secondary">{targetFile?.name}</span></p>
          <FolderPicker accountId={activeAccountId} selectedId={pickerFolderId}
            onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await copyFile(targetFile!, pickerFolderId!); showToast(`Copied to ${pickerFolderName}`, "success"); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Copying…" : "Copy here"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "share" && (
        <Modal title="Share file" onClose={closeModal} isOpen>
          {isProcessing ? (
            <div className="flex items-center justify-center py-6 gap-3">
              <Spinner size={18} />
              <span className="text-sm text-text-muted">Generating link…</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-3">Anyone with this link can view the file:</p>
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className={INPUT_CLS} style={INPUT_STYLE} />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Copied to clipboard", "success"); }}
                  className="px-3 rounded text-xs font-medium shrink-0" style={BTN_PRIMARY_STYLE}>Copy</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {activeModal === "bulkDelete" && (
        <Modal title="Delete files" onClose={closeModal} isOpen>
          <p className="text-sm text-text-secondary mb-4">Delete <strong className="text-text-primary">{selectedFiles.length} files</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { const r = await bulkDelete(selectedFiles); showToast(`Deleted ${r.success.length}${r.failed.length ? `, ${r.failed.length} failed` : ""} files`, r.failed.length ? "warn" : "success"); clearSelection(); closeModal(); })}
              disabled={isProcessing} className={BTN_DANGER} style={BTN_DANGER_STYLE}>
              {isProcessing ? "Deleting…" : `Delete ${selectedFiles.length} files`}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "bulkMove" && (
        <Modal title={`Move ${selectedFiles.length} files`} onClose={closeModal} width="max-w-sm" isOpen>
          <FolderPicker accountId={activeAccountId} selectedId={pickerFolderId}
            onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { const r = await bulkMove(selectedFiles, pickerFolderId!); showToast(`Moved ${r.success.length} files`, r.failed.length ? "warn" : "success"); clearSelection(); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Moving…" : `Move ${selectedFiles.length} files here`}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "transfer" && targetFile && (
        <TransferModal
          isOpen
          onClose={() => { closeModal(); setTransferStatus(null); }}
          sourceFile={targetFile}
          sourceAccount={accounts.find((a) => a.id === activeAccountId) || null}
          accounts={accounts}
          onTransfer={handleCrossAccountTransfer}
          transferStatus={transferStatus}
        />
      )}

      {isSearchOpen && (
        <SearchBar
          query={query} onQueryChange={setQuery}
          results={results} isSearching={isSearching}
          onClose={closeSearch} onSelectResult={handleSearchSelect}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
