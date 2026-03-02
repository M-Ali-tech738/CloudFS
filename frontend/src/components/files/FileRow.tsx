"use client";
import { Folder, FileText, Image, Film, Music, Archive, Code, Download, Share2, Pencil, Trash2, Move, Copy, Eye } from "lucide-react";
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

function getFileIcon(mime: string, type: string) {
  if (type === "folder") return { Icon: Folder, color: "#63d387" };
  if (mime?.startsWith("image/")) return { Icon: Image, color: "#60a5fa" };
  if (mime?.startsWith("video/")) return { Icon: Film, color: "#c084fc" };
  if (mime?.startsWith("audio/")) return { Icon: Music, color: "#f472b6" };
  if (mime?.includes("zip") || mime?.includes("tar") || mime?.includes("rar")) return { Icon: Archive, color: "#fb923c" };
  if (mime?.includes("code") || mime?.includes("javascript") || mime?.includes("json") || mime?.includes("html") || mime?.includes("css")) return { Icon: Code, color: "#34d399" };
  return { Icon: FileText, color: "#8892a4" };
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function formatDate(date: any): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function FileRow({ file, isSelected, isChecked, isSelectMode, onSingleClick, onDoubleClick, onLongPressStart, onLongPressEnd, onToggleCheck, onRename, onDelete, onMove, onCopy, onDownload, onShare, onPreview }: FileRowProps) {
  const { Icon, color } = getFileIcon(file.mime_type || "", file.type);

  const handleClick = () => {
    if (isSelectMode) { onToggleCheck(file); return; }
    onSingleClick(file);
  };

  return (
    <div
      className={`file-row group ${isSelected ? "selected" : ""} ${isChecked ? "checked" : ""}`}
      onClick={handleClick}
      onDoubleClick={() => { if (!isSelectMode) onDoubleClick(file); }}
      onTouchStart={() => onLongPressStart(file)}
      onTouchEnd={onLongPressEnd}
      onMouseDown={() => onLongPressStart(file)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
    >
      {/* Checkbox */}
      {isSelectMode && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleCheck(file); }}
          className="shrink-0 w-4 h-4 rounded transition-all cursor-pointer flex items-center justify-center"
          style={{
            border: isChecked ? "1.5px solid #63d387" : "1.5px solid var(--border)",
            background: isChecked ? "#63d387" : "transparent",
          }}
        >
          {isChecked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="#0a0c10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* File icon */}
      <div className="shrink-0 w-7 h-7 rounded flex items-center justify-center" style={{ background: `${color}12` }}>
        <Icon size={14} style={{ color }} strokeWidth={1.5} />
      </div>

      {/* Thumbnail */}
      {file.thumbnail_link && file.type !== "folder" && (
        <img src={file.thumbnail_link} alt="" className="shrink-0 w-7 h-7 rounded object-cover" style={{ border: "1px solid var(--border)" }} />
      )}

      {/* Name */}
      <span className="flex-1 text-sm text-text-primary truncate min-w-0">{file.name}</span>

      {/* Meta */}
      <span className="hidden sm:block text-xs text-text-muted shrink-0 w-16 text-right tabular-nums">{formatSize(file.size)}</span>
      <span className="hidden md:block text-xs text-text-muted shrink-0 w-20 text-right tabular-nums">{formatDate(file.modified_at)}</span>

      {/* Actions — visible on hover */}
      {!isSelectMode && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.type !== "folder" && (
            <ActionBtn onClick={(e) => { e.stopPropagation(); onPreview(file); }} title="Preview" icon={<Eye size={12} />} />
          )}
          <ActionBtn onClick={(e) => { e.stopPropagation(); onDownload(file); }} title="Download" icon={<Download size={12} />} />
          <ActionBtn onClick={(e) => { e.stopPropagation(); onShare(file); }} title="Share" icon={<Share2 size={12} />} />
          <ActionBtn onClick={(e) => { e.stopPropagation(); onMove(file); }} title="Move" icon={<Move size={12} />} />
          <ActionBtn onClick={(e) => { e.stopPropagation(); onCopy(file); }} title="Copy" icon={<Copy size={12} />} />
          <ActionBtn onClick={(e) => { e.stopPropagation(); onRename(file); }} title="Rename" icon={<Pencil size={12} />} />
          <ActionBtn onClick={(e) => { e.stopPropagation(); onDelete(file); }} title="Delete" icon={<Trash2 size={12} />} danger />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, title, icon, danger }: { onClick: (e: React.MouseEvent) => void; title: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{
        color: danger ? "var(--danger)" : "var(--text-3)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "rgba(248,113,113,0.1)" : "var(--bg-3)"; e.currentTarget.style.color = danger ? "#f87171" : "var(--text-1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? "var(--danger)" : "var(--text-3)"; }}
    >
      {icon}
    </button>
  );
}
