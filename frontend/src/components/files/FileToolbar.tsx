"use client";
import { Upload, FolderPlus, Search, RefreshCw, SortAsc } from "lucide-react";
import { useRef } from "react";

interface FileToolbarProps {
  onUpload: (file: File) => void;
  onCreateFolder: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  isLoading?: boolean;
}

export function FileToolbar({
  onUpload, onCreateFolder, onSearch, onRefresh, sortBy, onSortChange, isLoading
}: FileToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
      {/* Upload */}
      <input ref={inputRef} type="file" className="hidden" multiple
        onChange={(e) => { Array.from(e.target.files || []).forEach(onUpload); e.target.value = ""; }} />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-surface text-xs font-semibold hover:bg-accent/90 transition-colors"
      >
        <Upload size={13} /> Upload
      </button>

      {/* New Folder */}
      <button
        onClick={onCreateFolder}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 text-text-secondary text-xs font-medium hover:bg-surface-1 border border-border transition-colors"
      >
        <FolderPlus size={13} /> New Folder
      </button>

      <div className="flex-1" />

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="text-xs bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-text-secondary focus:outline-none focus:border-accent"
      >
        <option value="name">Name</option>
        <option value="modified">Modified</option>
        <option value="size">Size</option>
        <option value="type">Type</option>
      </select>

      {/* Search */}
      <button
        onClick={onSearch}
        className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary border border-transparent hover:border-border transition-colors"
        title="Search (Ctrl+K)"
      >
        <Search size={15} />
      </button>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className={`p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary border border-transparent hover:border-border transition-colors ${isLoading ? "animate-spin" : ""}`}
        title="Refresh"
      >
        <RefreshCw size={15} />
      </button>
    </div>
  );
}
