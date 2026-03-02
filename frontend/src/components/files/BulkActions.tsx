"use client";
import { Trash2, Move, X, CheckSquare } from "lucide-react";
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
    <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/10 border-b border-accent/20">
      <button onClick={allSelected ? onClearSelection : onSelectAll} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors">
        <CheckSquare size={14} />
        {allSelected ? "Deselect all" : "Select all"}
      </button>

      <span className="text-xs text-text-muted">{count} selected</span>

      <div className="flex-1" />

      <button
        onClick={onBulkMove}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-surface-1 transition-colors"
      >
        <Move size={13} /> Move
      </button>

      <button
        onClick={onBulkDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 border border-red-800 text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        <Trash2 size={13} /> Delete
      </button>

      <button onClick={onClearSelection} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}
