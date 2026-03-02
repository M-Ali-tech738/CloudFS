"use client";
import { Search, X, Loader, Folder, FileText, Image, Film } from "lucide-react";
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

function ResultIcon({ file }: { file: FileModel }) {
  if (file.type === "folder") return <Folder size={14} style={{ color: "#63d387" }} />;
  const mime = file.mime_type || "";
  if (mime.startsWith("image/")) return <Image size={14} style={{ color: "#60a5fa" }} />;
  if (mime.startsWith("video/")) return <Film size={14} style={{ color: "#c084fc" }} />;
  return <FileText size={14} style={{ color: "#8892a4" }} />;
}

export function SearchBar({ query, onQueryChange, results, isSearching, onClose, onSelectResult }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex flex-col items-center pt-20 px-4">
        {/* Search input */}
        <div
          className="w-full max-w-lg animate-scale-in"
          style={{
            background: "var(--bg-1)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: results.length > 0 || (query && !isSearching) ? "1px solid var(--border)" : "none" }}>
            {isSearching
              ? <Loader size={15} className="animate-spin shrink-0" style={{ color: "var(--text-3)" }} />
              : <Search size={15} style={{ color: "var(--text-3)" }} className="shrink-0" />}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search files and folders..."
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            {query
              ? <button onClick={() => onQueryChange("")} className="text-text-muted hover:text-text-primary transition-colors"><X size={14} /></button>
              : <kbd className="text-text-muted font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>Esc</kbd>
            }
          </div>

          {/* Results */}
          {(results.length > 0 || (query && !isSearching)) && (
            <div className="max-h-72 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted text-sm">No results for "{query}"</div>
              ) : (
                results.map((file, i) => (
                  <button
                    key={file.id}
                    onClick={() => { onSelectResult(file); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <ResultIcon file={file} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{file.name}</p>
                      {file.mime_type && <p className="text-xs text-text-muted truncate">{file.mime_type.replace("application/vnd.google-apps.", "")}</p>}
                    </div>
                    {file.thumbnail_link && <img src={file.thumbnail_link} alt="" className="w-8 h-8 rounded object-cover shrink-0" style={{ border: "1px solid var(--border)" }} />}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Hint */}
          {!query && (
            <div className="px-4 py-3 flex items-center gap-4">
              {[["↵", "Open"], ["Esc", "Close"]].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <kbd className="font-mono text-text-muted px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>{key}</kbd>
                  <span className="text-xs text-text-muted">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
