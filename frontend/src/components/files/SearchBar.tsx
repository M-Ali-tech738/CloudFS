"use client";
import { Search, X, Loader, Folder, File } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FileModel } from "@/types";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: FileModel[];
  isSearching: boolean;
  onClose: () => void;
  onSelectResult: (file: FileModel) => void;
}

export function SearchBar({ query, onQueryChange, results, isSearching, onClose, onSelectResult }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mt-16 mx-auto w-full max-w-xl px-4">
        {/* Input */}
        <div className="flex items-center gap-3 bg-surface-1 border border-border rounded-2xl px-4 py-3 shadow-2xl">
          {isSearching ? <Loader size={16} className="animate-spin text-text-muted shrink-0" /> : <Search size={16} className="text-text-muted shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
          />
          {query && (
            <button onClick={() => onQueryChange("")} className="text-text-muted hover:text-text-primary">
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:block text-xs text-text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        {(results.length > 0 || (query && !isSearching)) && (
          <div className="mt-2 bg-surface-1 border border-border rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">No results for "{query}"</div>
            ) : (
              results.map((file) => (
                <button
                  key={file.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-border last:border-0"
                  onClick={() => { onSelectResult(file); onClose(); }}
                >
                  {file.type === "folder"
                    ? <Folder size={15} className="text-accent shrink-0" />
                    : <File size={15} className="text-text-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{file.name}</p>
                    <p className="text-xs text-text-muted">{file.mime_type}</p>
                  </div>
                  {file.thumbnail_link && (
                    <img src={file.thumbnail_link} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
