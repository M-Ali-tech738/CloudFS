"use client";

import { useState, useRef } from "react";
import { 
  Upload, 
  FolderPlus, 
  Search, 
  RefreshCw, 
  ChevronDown,
  ArrowLeftRight
} from "lucide-react";

interface FileToolbarProps {
  onUpload: (file: File) => void;
  onCreateFolder: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  isLoading?: boolean;
  showTransferQueue?: () => void;  // Add this optional prop
}

export function FileToolbar({
  onUpload,
  onCreateFolder,
  onSearch,
  onRefresh,
  sortBy,
  onSortChange,
  isLoading,
  showTransferQueue,
}: FileToolbarProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  };

  const sortOptions = [
    { value: "name", label: "Name" },
    { value: "modified", label: "Last modified" },
    { value: "size", label: "Size" },
    { value: "type", label: "Type" },
  ];

  const currentSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label || "Name";

  return (
    <div className="flex items-center gap-1 px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Upload button */}
      <button
        onClick={handleUploadClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
        style={{ background: "rgba(99,211,135,0.1)", border: "1px solid rgba(99,211,135,0.2)", color: "#63d387" }}
      >
        <Upload size={14} />
        <span className="hidden sm:inline">Upload</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* New folder button */}
      <button
        onClick={onCreateFolder}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
      >
        <FolderPlus size={14} />
        <span className="hidden sm:inline">New folder</span>
      </button>

      {/* Transfer queue button (optional) */}
      {showTransferQueue && (
        <button
          onClick={showTransferQueue}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80 ml-auto"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
          title="Show transfer queue"
        >
          <ArrowLeftRight size={14} />
          <span className="hidden sm:inline">Transfers</span>
        </button>
      )}

      {/* Search button */}
      <button
        onClick={onSearch}
        className="p-1.5 rounded hover:bg-white/5 transition-colors ml-auto"
        title="Search (⌘K)"
        style={{ color: "var(--text-3)" }}
      >
        <Search size={16} />
      </button>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        className="p-1.5 rounded hover:bg-white/5 transition-colors"
        disabled={isLoading}
        style={{ color: "var(--text-3)" }}
      >
        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
      </button>

      {/* Sort dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-3)" }}
        >
          <span>Sort: {currentSortLabel}</span>
          <ChevronDown size={12} />
        </button>

        {showSortMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-20 min-w-32"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
            >
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setShowSortMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                  style={{ 
                    color: sortBy === option.value ? "#63d387" : "var(--text-2)",
                    background: sortBy === option.value ? "rgba(99,211,135,0.1)" : "transparent"
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
