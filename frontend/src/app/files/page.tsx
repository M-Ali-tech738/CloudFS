"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, LogOut, Cloud } from "lucide-react";

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

export default function FilesPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!userLoading && isUnauthenticated) window.location.href = "/";
  }, [isUnauthenticated, userLoading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); openSearch(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  const handleLogout = async () => { await auth.logout(); window.location.href = "/"; };

  const handleFileSingleClick = useCallback((file: FileModel) => {
    setSelectedIndex(sortedFiles.indexOf(file));
    if (file.type !== "folder") openPreview(file);
  }, [sortedFiles, openPreview]);

  const handleFileDoubleClick = useCallback((file: FileModel) => {
    if (file.type === "folder") openFolder(file);
    else if (file.web_view_link) window.open(file.web_view_link, "_blank");
  }, [openFolder]);

  const handleDownload = useCallback((file: FileModel) => {
    const a = document.createElement("a");
    a.href = filesApi.download(file.id);
    a.download = file.name;
    a.click();
  }, []);

  const handleShare = useCallback(async (file: FileModel) => {
    setTargetFile(file);
    setActiveModal("share");
    setIsProcessing(true);
    try {
      const { share_url } = await shareFile(file);
      setShareUrl(share_url);
    } catch (err: any) {
      showToast(err.message || "Failed to generate share link");
      setActiveModal(null);
    } finally { setIsProcessing(false); }
  }, [shareFile, showToast]);

  const handleRename = useCallback((file: FileModel) => { setTargetFile(file); setInputValue(file.name); setActiveModal("rename"); }, []);
  const handleDelete = useCallback((file: FileModel) => { setTargetFile(file); setActiveModal("confirmDelete"); }, []);
  const handleMove = useCallback((file: FileModel) => { setTargetFile(file); setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("move"); }, [currentFolder]);
  const handleCopy = useCallback((file: FileModel) => { setTargetFile(file); setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("copy"); }, [currentFolder]);
  const handleBulkDelete = () => setActiveModal("bulkDelete");
  const handleBulkMove = () => { setPickerFolderId(currentFolder.id); setPickerFolderName(currentFolder.name); setActiveModal("bulkMove"); };

  const handleSearchSelect = useCallback((file: FileModel) => {
    if (file.type === "folder") setFolderStack([{ id: "root", name: "My Drive" }, { id: file.id, name: file.name }]);
    else openPreview(file);
  }, [openPreview]);

  const confirmRename = async () => {
    if (!targetFile || !inputValue.trim()) return;
    setIsProcessing(true);
    try { await renameFile(targetFile, inputValue.trim()); showToast("Renamed", "success"); setActiveModal(null); }
    catch (err: any) { showToast(err.message || "Rename failed"); }
    finally { setIsProcessing(false); }
  };

  const confirmDelete = async () => {
    if (!targetFile) return;
    setIsProcessing(true);
    try { await deleteFile(targetFile); showToast("Deleted", "success"); setActiveModal(null); if (previewFile?.id === targetFile.id) closePreview(); }
    catch (err: any) { showToast(err.message || "Delete failed"); }
    finally { setIsProcessing(false); }
  };

  const confirmMove = async () => {
    if (!targetFile || !pickerFolderId) return;
    setIsProcessing(true);
    try { await moveFile(targetFile, pickerFolderId); showToast(`Moved to ${pickerFolderName}`, "success"); setActiveModal(null); }
    catch (err: any) { showToast(err.message || "Move failed"); }
    finally { setIsProcessing(false); }
  };

  const confirmCopy = async () => {
    if (!targetFile || !pickerFolderId) return;
    setIsProcessing(true);
    try { await copyFile(targetFile, pickerFolderId); showToast(`Copied to ${pickerFolderName}`, "success"); setActiveModal(null); }
    catch (err: any) { showToast(err.message || "Copy failed"); }
    finally { setIsProcessing(false); }
  };

  const confirmCreateFolder = async () => {
    if (!inputValue.trim()) return;
    setIsProcessing(true);
    try { await createFolder(inputValue.trim()); showToast("Folder created", "success"); setActiveModal(null); }
    catch (err: any) { showToast(err.message || "Failed to create folder"); }
    finally { setIsProcessing(false); }
  };

  const confirmBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const result = await bulkDelete(selectedFiles);
      showToast(`Deleted ${result.success.length} files${result.failed.length ? `, ${result.failed.length} failed` : ""}`, result.failed.length ? "warn" : "success");
      clearSelection(); setActiveModal(null);
    } catch (err: any) { showToast(err.message || "Bulk delete failed"); }
    finally { setIsProcessing(false); }
  };

  const confirmBulkMove = async () => {
    if (!pickerFolderId) return;
    setIsProcessing(true);
    try {
      const result = await bulkMove(selectedFiles, pickerFolderId);
      showToast(`Moved ${result.success.length} files${result.failed.length ? `, ${result.failed.length} failed` : ""}`, result.failed.length ? "warn" : "success");
      clearSelection(); setActiveModal(null);
    } catch (err: any) { showToast(err.message || "Bulk move failed"); }
    finally { setIsProcessing(false); }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4"><Spinner size={32} /><p className="text-text-muted text-sm">Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <Cloud size={18} className="text-accent" />
          <span className="font-mono text-sm font-semibold text-text-primary hidden sm:block">CloudFS</span>
        </div>
        <nav className="flex items-center gap-1 flex-1 min-w-0">
          {folderStack.map((folder, i) => (
            <div key={folder.id} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={13} className="text-text-muted shrink-0" />}
              <button
                onClick={() => { setFolderStack(folderStack.slice(0, i + 1)); setSelectedIndex(-1); closePreview(); }}
                className={`text-sm truncate max-w-32 transition-colors ${i === folderStack.length - 1 ? "text-text-primary font-medium" : "text-text-muted hover:text-text-secondary"}`}
              >{folder.name}</button>
            </div>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text-muted hidden sm:block truncate max-w-32">{user.email}</span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors" title="Sign out">
              <LogOut size={13} /><span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        )}
      </header>

      <FileToolbar
        onUpload={async (file) => { try { await uploadFile(file); showToast(`Uploaded ${file.name}`, "success"); } catch (err: any) { showToast(err.message || "Upload failed"); } }}
        onCreateFolder={() => { setInputValue(""); setActiveModal("createFolder"); }}
        onSearch={openSearch}
        onRefresh={revalidate}
        sortBy={sortBy}
        onSortChange={(s) => setSortBy(s as SortKey)}
        isLoading={isLoading}
      />

      {isSelectMode && hasSelection && (
        <BulkActions selectedFiles={selectedFiles} allFiles={sortedFiles} onSelectAll={selectAll} onClearSelection={clearSelection} onBulkDelete={handleBulkDelete} onBulkMove={handleBulkMove} />
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-3 ${previewFile ? "hidden lg:block lg:w-1/2" : ""}`}>
          <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-muted border-b border-border mb-1">
            {isSelectMode && <div className="w-4" />}
            <div className="w-4" />
            <span className="flex-1">Name</span>
            <span className="hidden sm:block w-20 text-right">Size</span>
            <span className="hidden md:block w-28 text-right">Modified</span>
          </div>

          {isLoading && <div className="flex items-center gap-3 px-3 py-6 text-text-muted text-sm"><Spinner size={16} /> Loading files...</div>}
          {error && <div className="flex items-center gap-2 px-3 py-4 text-danger text-sm bg-danger/10 rounded-lg border border-danger/20 mt-2"><AlertTriangle size={15} /> {error.message}</div>}
          {!isLoading && !error && sortedFiles.length === 0 && <div className="px-3 py-12 text-center text-text-muted text-sm">This folder is empty.</div>}

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

        {previewFile && (
          <div className="w-full lg:w-1/2 border-l border-border overflow-hidden flex flex-col">
            <FilePreview file={previewFile} onClose={closePreview} onDownload={handleDownload} />
          </div>
        )}
      </div>

      {activeModal === "rename" && (
        <Modal title={`Rename "${targetFile?.name}"`} onClose={() => setActiveModal(null)}>
          <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmRename} disabled={isProcessing} className="flex-1 py-2 rounded-xl bg-accent text-surface text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">{isProcessing ? "Renaming..." : "Rename"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "createFolder" && (
        <Modal title="New Folder" onClose={() => setActiveModal(null)}>
          <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmCreateFolder()}
            placeholder="Folder name" className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted" />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmCreateFolder} disabled={isProcessing || !inputValue.trim()} className="flex-1 py-2 rounded-xl bg-accent text-surface text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">{isProcessing ? "Creating..." : "Create"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "confirmDelete" && (
        <Modal title="Delete file?" onClose={() => setActiveModal(null)}>
          <p className="text-sm text-text-secondary mb-4">Delete <strong className="text-text-primary">"{targetFile?.name}"</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmDelete} disabled={isProcessing} className="flex-1 py-2 rounded-xl bg-red-900 border border-red-700 text-sm font-semibold text-red-300 hover:bg-red-800 disabled:opacity-50 transition-colors">{isProcessing ? "Deleting..." : "Delete"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "move" && (
        <Modal title={`Move "${targetFile?.name}"`} onClose={() => setActiveModal(null)} width="max-w-sm">
          <p className="text-xs text-text-muted mb-3">Select destination folder:</p>
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} excludeId={targetFile?.id} />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmMove} disabled={isProcessing || !pickerFolderId} className="flex-1 py-2 rounded-xl bg-accent text-surface text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">{isProcessing ? "Moving..." : "Move here"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "copy" && (
        <Modal title={`Copy "${targetFile?.name}"`} onClose={() => setActiveModal(null)} width="max-w-sm">
          <p className="text-xs text-text-muted mb-3">Select destination folder:</p>
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmCopy} disabled={isProcessing || !pickerFolderId} className="flex-1 py-2 rounded-xl bg-accent text-surface text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">{isProcessing ? "Copying..." : "Copy here"}</button>
          </div>
        </Modal>
      )}

      {activeModal === "share" && (
        <Modal title={`Share "${targetFile?.name}"`} onClose={() => setActiveModal(null)}>
          {isProcessing ? (
            <div className="flex items-center justify-center py-6 gap-3"><Spinner size={20} /><span className="text-sm text-text-muted">Generating link...</span></div>
          ) : (
            <>
              <p className="text-xs text-text-muted mb-2">Anyone with this link can view:</p>
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Link copied!", "success"); }} className="px-3 py-2 rounded-xl bg-accent text-surface text-xs font-semibold hover:bg-accent/90 transition-colors">Copy</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {activeModal === "bulkDelete" && (
        <Modal title="Delete selected files?" onClose={() => setActiveModal(null)}>
          <p className="text-sm text-text-secondary mb-4">Delete <strong className="text-text-primary">{selectedFiles.length} files</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmBulkDelete} disabled={isProcessing} className="flex-1 py-2 rounded-xl bg-red-900 border border-red-700 text-sm font-semibold text-red-300 hover:bg-red-800 disabled:opacity-50 transition-colors">{isProcessing ? "Deleting..." : `Delete ${selectedFiles.length} files`}</button>
          </div>
        </Modal>
      )}

      {activeModal === "bulkMove" && (
        <Modal title={`Move ${selectedFiles.length} files`} onClose={() => setActiveModal(null)} width="max-w-sm">
          <p className="text-xs text-text-muted mb-3">Select destination folder:</p>
          <FolderPicker selectedId={pickerFolderId} onSelect={(id, name) => { setPickerFolderId(id); setPickerFolderName(name); }} />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors">Cancel</button>
            <button onClick={confirmBulkMove} disabled={isProcessing || !pickerFolderId} className="flex-1 py-2 rounded-xl bg-accent text-surface text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">{isProcessing ? "Moving..." : `Move ${selectedFiles.length} files here`}</button>
          </div>
        </Modal>
      )}

      {isSearchOpen && <SearchBar query={query} onQueryChange={setQuery} results={results} isSearching={isSearching} onClose={closeSearch} onSelectResult={handleSearchSelect} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
