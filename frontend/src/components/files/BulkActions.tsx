"use client";
import { Trash2, Move, X } from "lucide-react";
import type { FileModel } from "@/types";

interface BulkActionsProps {
  selectedFiles: FileModel[];
  allFiles: FileModel[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMove: () => void;
}

export function BulkActions({ selectedFiles, allFiles, onSelectAll, onClearSelection, onBulkDelete, onBulkMove }: BulkActionsProps) {
  const count = selectedFiles.length;
  const allSelected = count === allFiles.length;

  return (
    <div className="flex items-center gap-3 px-4 py-2 animate-fade-in" style={{
      background: "rgba(99,211,135,0.05)",
      borderBottom: "1px solid rgba(99,211,135,0.12)",
    }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-medium" style={{ color: "#63d387" }}>{count} selected</span>
        <button
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="flex-1" />

      <button
        onClick={onBulkMove}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-text-secondary hover:text-text-primary"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        <Move size={12} /> Move
      </button>

      <button
        onClick={onBulkDelete}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
        style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}
      >
        <Trash2 size={12} /> Delete
      </button>

      <button onClick={onClearSelection} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}
