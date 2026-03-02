"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronRight, LogOut, Cloud, HardDrive } from "lucide-react";

import { auth, files as filesApi } from "@/lib/api";
import type { FileModel } from "@/types";

import { useUser } from "@/hooks/useUser";
import { useFiles } from "@/hooks/useFiles";
import { useSearch } from "@/hooks/useSearch";
import { useSelection } from "@/hooks/useSelection";
import { usePreview } from "@/hooks/usePreview";
import { useSSE, useKeyboardNav } from "@/hooks/useSSE";

import { FileRow } from "@/components/files/FileRow";
import { FileToolbar } from "@/components/files/FileToolbar";
import { FilePreview } from "@/components/files/FilePreview";
import { FolderPicker } from "@/components/files/FolderPicker";
import { SearchBar } from "@/components/files/SearchBar";
import { BulkActions } from "@/components/files/BulkActions";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

type ToastState = { message: string; type: "success" | "error" | "warn" } | null;
type ModalType = "rename" | "createFolder" | "move" | "copy" | "share" | "confirmDelete" | "bulkMove" | "bulkDelete" | null;
type SortKey = "name" | "modified" | "size" | "type";

function sortFiles(fileList: FileModel[], sortBy: SortKey): FileModel[] {
  return [...fileList].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    switch (sortBy) {
      case "name": return a.name.localeCompare(b.name);
      case "modified": return new Date(b.modified_at as any).getTime() - new Date(a.modified_at as any).getTime();
      case "size": return (b.size || 0) - (a.size || 0);
      case "type": return (a.mime_type || "").localeCompare(b.mime_type || "");
      default: return 0;
    }
  });
}

const INPUT_CLS = "w-full rounded px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors";
const INPUT_STYLE = { background: "var(--bg-2)", border: "1px solid var(--border)" };
const INPUT_FOCUS = { borderColor: "rgba(99,211,135,0.4)" };

const BTN_CANCEL = "flex-1 py-2 rounded text-sm text-text-secondary transition-colors";
const BTN_CANCEL_STYLE = { background: "var(--bg-2)", border: "1px solid var(--border)" };

const BTN_PRIMARY = "flex-1 py-2 rounded text-sm font-medium transition-all disabled:opacity-40";
const BTN_PRIMARY_STYLE = { background: "rgba(99,211,135,0.15)", border: "1px solid rgba(99,211,135,0.3)", color: "#63d387" };

const BTN_DANGER = "flex-1 py-2 rounded text-sm font-medium transition-all disabled:opacity-40";
const BTN_DANGER_STYLE = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" };

export default function FilesPage() {
  const { user, isLoading: userLoading, isUnauthenticated } = useUser();

  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const currentFolder = folderStack[folderStack.length - 1];

  const { files, isLoading, error, deleteFile, renameFile, moveFile, copyFile, uploadFile, createFolder, shareFile, bulkDelete, bulkMove, revalidate } = useFiles(currentFolder.id);

  const [sortBy, setSortBy] = useState<SortKey>("name");
  const sortedFiles = useMemo(() => sortFiles(files, sortBy), [files, sortBy]);

  const { selectedIds, selectedFiles, hasSelection, isSelectMode, toggleSelect, selectAll, clearSelection, onLongPressStart, onLongPressEnd } = useSelection(sortedFiles);
  const { previewFile, openPreview, closePreview } = usePreview();
  const { query, setQuery, results, isSearching, isOpen: isSearchOpen, openSearch, closeSearch } = useSearch();

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const openFolder = useCallback((file: FileModel) => {
    if (file.type === "folder") {
      setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
      setSelectedIndex(-1);
      closePreview();
    }
  }, [closePreview]);

  useKeyboardNav(sortedFiles, selectedIndex, setSelectedIndex, openFolder);
  useSSE(currentFolder.id);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [targetFile, setTargetFile] = useState<FileModel | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [pickerFolderId, setPickerFolderId] = useState<string | null>(null);
  const [pickerFolderName, setPickerFolderName] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "warn" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const closeModal = () => setActiveModal(null);

  useEffect(() => { if (!userLoading && isUnauthenticated) window.location.href = "/"; }, [isUnauthenticated, userLoading]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); openSearch(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [openSearch]);

  const handleLogout = async () => { await auth.logout(); window.location.href = "/"; };
  const handleFileSingleClick = useCallback((file: FileModel) => { setSelectedIndex(sortedFiles.indexOf(file)); if (file.type !== "folder") openPreview(file); }, [sortedFiles, openPreview]);
  const handleFileDoubleClick = useCallback((file: FileModel) => { if (file.type === "folder") openFolder(file); else if (file.web_view_link) window.open(file.web_view_link, "_blank"); }, [openFolder]);
  const handleDownload = useCallback((file: FileModel) => { const a = document.createElement("a"); a.href = filesApi.download(file.id); a.download = file.name; a.click(); }, []);
  const handleRename = useCallback((file: FileModel) => { setTargetFile(file); setInputValue(file.name); setActiveModal("rename"); }, []);
  const handleDelete = useCallback((file: FileModel) => { setTargetFile(file); setActiveModal("confirmDelete"); }, []);
  const handleMove = useCallback((file: FileModel) => { setTargetFile(file); setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("move"); }, [currentFolder]);
  const handleCopy = useCallback((file: FileModel) => { setTargetFile(file); setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("copy"); }, [currentFolder]);

  const handleShare = useCallback(async (file: FileModel) => {
    setTargetFile(file); setActiveModal("share"); setIsProcessing(true);
    try { const { share_url } = await shareFile(file); setShareUrl(share_url); }
    catch (err: any) { showToast(err.message || "Failed to generate link"); setActiveModal(null); }
    finally { setIsProcessing(false); }
  }, [shareFile, showToast]);

  const handleSearchSelect = useCallback((file: FileModel) => {
    if (file.type === "folder") setFolderStack([{ id: "root", name: "My Drive" }, { id: file.id, name: file.name }]);
    else openPreview(file);
  }, [openPreview]);

  const run = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try { await action(); } catch (err: any) { showToast(err.message || "Action failed"); }
    finally { setIsProcessing(false); }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size={28} />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center gap-0 px-4 h-12" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>

        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "rgba(99,211,135,0.1)", border: "1px solid rgba(99,211,135,0.2)" }}>
            <Cloud size={13} style={{ color: "#63d387" }} strokeWidth={1.5} />
          </div>
          <span className="font-mono text-xs font-semibold text-text-secondary hidden sm:block tracking-widest uppercase">CloudFS</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 mr-4" style={{ background: "var(--border)" }} />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
          {folderStack.map((folder, i) => (
            <div key={folder.id} className="flex items-center gap-1 min-w-0 shrink-0">
              {i > 0 && <ChevronRight size={12} style={{ color: "var(--text-3)" }} className="shrink-0" />}
              <button
                onClick={() => { setFolderStack(folderStack.slice(0, i + 1)); setSelectedIndex(-1); closePreview(); }}
                className="text-xs transition-colors truncate max-w-28"
                style={{ color: i === folderStack.length - 1 ? "var(--text-1)" : "var(--text-3)" }}
                onMouseEnter={(e) => { if (i < folderStack.length - 1) e.currentTarget.style.color = "var(--text-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = i === folderStack.length - 1 ? "var(--text-1)" : "var(--text-3)"; }}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs text-text-muted hidden sm:block truncate max-w-36">{user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary transition-colors"
              style={{ border: "1px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.border = "1px solid var(--border)"; e.currentTarget.style.background = "var(--bg-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.border = "1px solid transparent"; e.currentTarget.style.background = "transparent"; }}
              title="Sign out"
            >
              <LogOut size={12} />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        )}
      </header>

      {/* ── Toolbar ── */}
      <FileToolbar
        onUpload={async (file) => { try { await uploadFile(file); showToast(`Uploaded ${file.name}`, "success"); } catch (err: any) { showToast(err.message || "Upload failed"); } }}
        onCreateFolder={() => { setInputValue(""); setActiveModal("createFolder"); }}
        onSearch={openSearch}
        onRefresh={revalidate}
        sortBy={sortBy}
        onSortChange={(s) => setSortBy(s as SortKey)}
        isLoading={isLoading}
      />

      {/* ── Bulk actions ── */}
      {isSelectMode && hasSelection && (
        <BulkActions selectedFiles={selectedFiles} allFiles={sortedFiles} onSelectAll={selectAll} onClearSelection={clearSelection}
          onBulkDelete={() => setActiveModal("bulkDelete")} onBulkMove={() => { setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("bulkMove"); }} />
      )}

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* File list */}
        <div className={`flex flex-col overflow-hidden ${previewFile ? "hidden lg:flex lg:flex-1" : "flex-1"}`}>
          {/* Column headers */}
          <div className="flex items-center gap-2.5 px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {isSelectMode && <div className="w-4" />}
            <div className="w-7" />
            <span className="flex-1 text-xs font-medium" style={{ color: "var(--text-3)" }}>Name</span>
            <span className="hidden sm:block text-xs font-medium w-16 text-right" style={{ color: "var(--text-3)" }}>Size</span>
            <span className="hidden md:block text-xs font-medium w-20 text-right" style={{ color: "var(--text-3)" }}>Modified</span>
            <div className="w-28 hidden sm:block" />
          </div>

          {/* File rows */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5">
            {isLoading && (
              <div className="flex items-center gap-3 px-3 py-8 text-text-muted text-sm">
                <Spinner size={14} /> Loading files...
              </div>
            )}

            {error && (
              <div className="mx-2 mt-3 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#f87171" }}>
                {error.message}
              </div>
            )}

            {!isLoading && !error && sortedFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <HardDrive size={20} style={{ color: "var(--text-3)" }} strokeWidth={1.5} />
                </div>
                <p className="text-sm text-text-muted">This folder is empty</p>
              </div>
            )}

            {sortedFiles.map((file, index) => (
              <FileRow
                key={file.id} file={file}
                isSelected={selectedIndex === index} isChecked={selectedIds.has(file.id)} isSelectMode={isSelectMode}
                onSingleClick={handleFileSingleClick} onDoubleClick={handleFileDoubleClick}
                onLongPressStart={onLongPressStart} onLongPressEnd={onLongPressEnd}
                onToggleCheck={toggleSelect} onRename={handleRename} onDelete={handleDelete}
                onMove={handleMove} onCopy={handleCopy} onDownload={handleDownload}
                onShare={handleShare} onPreview={(f) => openPreview(f)}
              />
            ))}
          </div>

          {/* Status bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-1.5" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-1)" }}>
            <span className="font-mono text-xs" style={{ color: "var(--text-3)" }}>
              {isLoading ? "Loading..." : `${sortedFiles.length} item${sortedFiles.length !== 1 ? "s" : ""}`}
            </span>
            {isSelectMode && hasSelection && (
              <span className="font-mono text-xs" style={{ color: "#63d387" }}>{selectedFiles.length} selected</span>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {previewFile && (
          <div className="w-full lg:w-96 xl:w-[420px] shrink-0 overflow-hidden flex flex-col" style={{ borderLeft: "1px solid var(--border)" }}>
            <FilePreview file={previewFile} onClose={closePreview} onDownload={handleDownload} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {activeModal === "rename" && (
        <Modal title="Rename" onClose={closeModal}>
          <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(async () => { await renameFile(targetFile!, inputValue.trim()); showToast("Renamed", "success"); closeModal(); })}
            className={INPUT_CLS} style={INPUT_STYLE}
            onFocus={(e) => { e.target.style.borderColor = "rgba(99,211,135,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
          />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await renameFile(targetFile!, inputValue.trim()); showToast("Renamed", "success"); closeModal(); })}
              disabled={isProcessing || !inputValue.trim()} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Renaming..." : "Rename"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "createFolder" && (
        <Modal title="New Folder" onClose={closeModal}>
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
              {isProcessing ? "Creating..." : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "confirmDelete" && (
        <Modal title="Delete file" onClose={closeModal}>
          <p className="text-sm text-text-secondary mb-4">
            Delete <strong className="text-text-primary">"{targetFile?.name}"</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await deleteFile(targetFile!); showToast("Deleted", "success"); closeModal(); if (previewFile?.id === targetFile?.id) closePreview(); })}
              disabled={isProcessing} className={BTN_DANGER} style={BTN_DANGER_STYLE}>
              {isProcessing ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "move" && (
        <Modal title={`Move to…`} onClose={closeModal} width="max-w-sm">
          <p className="text-xs text-text-muted mb-3">Moving: <span className="text-text-secondary">{targetFile?.name}</span></p>
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} excludeId={targetFile?.id} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await moveFile(targetFile!, pickerFolderId!); showToast(`Moved to ${pickerFolderName}`, "success"); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Moving..." : "Move here"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "copy" && (
        <Modal title="Copy to…" onClose={closeModal} width="max-w-sm">
          <p className="text-xs text-text-muted mb-3">Copying: <span className="text-text-secondary">{targetFile?.name}</span></p>
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { await copyFile(targetFile!, pickerFolderId!); showToast(`Copied to ${pickerFolderName}`, "success"); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Copying..." : "Copy here"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "share" && (
        <Modal title="Share file" onClose={closeModal}>
          {isProcessing ? (
            <div className="flex items-center justify-center py-6 gap-3"><Spinner size={18} /><span className="text-sm text-text-muted">Generating link...</span></div>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-3">Anyone with this link can view the file:</p>
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className={INPUT_CLS} style={INPUT_STYLE} />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Copied to clipboard", "success"); }}
                  className="px-3 rounded text-xs font-medium shrink-0" style={BTN_PRIMARY_STYLE}>
                  Copy
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {activeModal === "bulkDelete" && (
        <Modal title="Delete files" onClose={closeModal}>
          <p className="text-sm text-text-secondary mb-4">Delete <strong className="text-text-primary">{selectedFiles.length} files</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { const r = await bulkDelete(selectedFiles); showToast(`Deleted ${r.success.length}${r.failed.length ? `, ${r.failed.length} failed` : ""} files`, r.failed.length ? "warn" : "success"); clearSelection(); closeModal(); })}
              disabled={isProcessing} className={BTN_DANGER} style={BTN_DANGER_STYLE}>
              {isProcessing ? "Deleting..." : `Delete ${selectedFiles.length} files`}
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "bulkMove" && (
        <Modal title={`Move ${selectedFiles.length} files`} onClose={closeModal} width="max-w-sm">
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={closeModal} className={BTN_CANCEL} style={BTN_CANCEL_STYLE}>Cancel</button>
            <button onClick={() => run(async () => { const r = await bulkMove(selectedFiles, pickerFolderId!); showToast(`Moved ${r.success.length} files`, r.failed.length ? "warn" : "success"); clearSelection(); closeModal(); })}
              disabled={isProcessing || !pickerFolderId} className={BTN_PRIMARY} style={BTN_PRIMARY_STYLE}>
              {isProcessing ? "Moving..." : `Move ${selectedFiles.length} files here`}
            </button>
          </div>
        </Modal>
      )}

      {isSearchOpen && <SearchBar query={query} onQueryChange={setQuery} results={results} isSearching={isSearching} onClose={closeSearch} onSelectResult={handleSearchSelect} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
