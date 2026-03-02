"use client";
import { useRef } from "react";
import { Folder, File, MoreVertical, Download, Share2, Pencil, Trash2, Move, Copy } from "lucide-react";
import type { FileModel } from "@/types";

interface FileRowProps {
  file: FileModel;
  isSelected: boolean;
  isChecked: boolean;
  isSelectMode: boolean;
  onSingleClick: (file: FileModel) => void;
  onDoubleClick: (file: FileModel) => void;
  onLongPressStart: (file: FileModel) => void;
  onLongPressEnd: () => void;
  onToggleCheck: (file: FileModel) => void;
  onRename: (file: FileModel) => void;
  onDelete: (file: FileModel) => void;
  onMove: (file: FileModel) => void;
  onCopy: (file: FileModel) => void;
  onDownload: (file: FileModel) => void;
  onShare: (file: FileModel) => void;
  onPreview: (file: FileModel) => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function FileRow({
  file, isSelected, isChecked, isSelectMode,
  onSingleClick, onDoubleClick, onLongPressStart, onLongPressEnd,
  onToggleCheck, onRename, onDelete, onMove, onCopy, onDownload, onShare, onPreview,
}: FileRowProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (isSelectMode) { onToggleCheck(file); return; }
    onSingleClick(file);
  };

  const handleDoubleClick = () => {
    if (isSelectMode) return;
    onDoubleClick(file);
  };

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${isSelected ? "bg-accent/10 border border-accent/20" : "hover:bg-surface-2 border border-transparent"}
        ${isChecked ? "bg-accent/15" : ""}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={() => onLongPressStart(file)}
      onTouchEnd={onLongPressEnd}
      onMouseDown={() => onLongPressStart(file)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      {/* Checkbox (select mode) */}
      {isSelectMode && (
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${isChecked ? "bg-accent border-accent" : "border-border"}`}
          onClick={(e) => { e.stopPropagation(); onToggleCheck(file); }}
        >
          {isChecked && <div className="w-2 h-2 bg-white rounded-sm" />}
        </div>
      )}

      {/* Icon */}
      <div className="shrink-0">
        {file.type === "folder"
          ? <Folder size={16} className="text-accent" />
          : <File size={16} className="text-text-muted" />}
      </div>

      {/* Thumbnail */}
      {file.thumbnail_link && file.type !== "folder" && (
        <img src={file.thumbnail_link} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
      )}

      {/* Name */}
      <span className="flex-1 text-sm text-text-primary truncate">{file.name}</span>

      {/* Meta */}
      <span className="hidden sm:block text-xs text-text-muted shrink-0 w-20 text-right">
        {formatSize(file.size)}
      </span>
      <span className="hidden md:block text-xs text-text-muted shrink-0 w-28 text-right">
        {formatDate(file.modified_at as unknown as string)}
      </span>

      {/* Actions menu */}
      {!isSelectMode && (
        <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
          <div className="flex items-center gap-1">
            {file.type !== "folder" && (
              <button
                onClick={(e) => { e.stopPropagation(); onPreview(file); }}
                className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
                title="Preview"
              >
                <File size={13} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(file); }}
              className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
              title="Download"
            >
              <Download size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(file); }}
              className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
              title="Share"
            >
              <Share2 size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMove(file); }}
              className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
              title="Move"
            >
              <Move size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(file); }}
              className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
              title="Copy"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRename(file); }}
              className="p-1.5 rounded-md hover:bg-surface-1 text-text-muted hover:text-text-primary"
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file); }}
              className="p-1.5 rounded-md hover:bg-red-950 text-text-muted hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
