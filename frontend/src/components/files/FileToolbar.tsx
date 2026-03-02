"use client";
import { Upload, FolderPlus, Search, RotateCw } from "lucide-react";
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

export function FileToolbar({ onUpload, onCreateFolder, onSearch, onRefresh, sortBy, onSortChange, isLoading }: FileToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>
      <input ref={inputRef} type="file" className="hidden" multiple
        onChange={(e) => { Array.from(e.target.files || []).forEach(onUpload); e.target.value = ""; }} />

      {/* Upload */}
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
        style={{
          background: "linear-gradient(180deg, rgba(99,211,135,0.18) 0%, rgba(99,211,135,0.1) 100%)",
          border: "1px solid rgba(99,211,135,0.25)",
          color: "#63d387",
        }}
      >
        <Upload size={12} strokeWidth={2.5} />
        Upload
      </button>

      {/* New Folder */}
      <button
        onClick={onCreateFolder}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all text-text-secondary hover:text-text-primary"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        <FolderPlus size={12} strokeWidth={2.5} />
        New Folder
      </button>

      <div className="flex-1" />

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="text-xs text-text-secondary focus:outline-none focus:border-accent/40 rounded px-2 py-1.5 cursor-pointer"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        <option value="name">Name</option>
        <option value="modified">Modified</option>
        <option value="size">Size</option>
        <option value="type">Type</option>
      </select>

      {/* Search */}
      <button
        onClick={onSearch}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary transition-colors"
        style={{ border: "1px solid var(--border)", background: "var(--bg-2)" }}
        title="Search (⌘K)"
      >
        <Search size={12} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-text-muted font-mono" style={{ fontSize: "10px" }}>⌘K</kbd>
      </button>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors"
        style={{ border: "1px solid var(--border)", background: "var(--bg-2)" }}
        title="Refresh"
      >
        <RotateCw size={13} className={isLoading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
