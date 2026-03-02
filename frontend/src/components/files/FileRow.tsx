"use client";

import { useState, useRef, useEffect } from "react";
import {
  File,
  Folder,
  Image,
  Video,
  Music,
  Code,
  FileText,
  Download,
  Trash2,
  Edit2,
  Share2,
  Copy,
  Move,
  Eye,
  MoreVertical,
  Check,
  Cloud,
} from "lucide-react";
import type { FileModel } from "@/types";
import { formatBytes, formatDate } from "@/lib/utils";

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
  onTransfer: (file: FileModel) => void;
}

function getFileIcon(file: FileModel) {
  if (file.type === "folder") return Folder;

  const mime = file.mime_type;
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Music;
  if (mime.includes("javascript") || mime.includes("python") || mime.includes("html")) return Code;
  if (mime.includes("document") || mime.includes("text")) return FileText;
  return File;
}

function getIconColor(file: FileModel) {
  if (file.type === "folder") return "#63d387";
  
  const mime = file.mime_type;
  if (mime.startsWith("image/")) return "#60a5fa";
  if (mime.startsWith("video/")) return "#a78bfa";
  if (mime.startsWith("audio/")) return "#f472b6";
  if (mime.includes("javascript") || mime.includes("python") || mime.includes("html")) return "#4fd1c5";
  if (mime.includes("document") || mime.includes("text")) return "#fbbf24";
  return "var(--text-3)";
}

export function FileRow({
  file,
  isSelected,
  isChecked,
  isSelectMode,
  onSingleClick,
  onDoubleClick,
  onLongPressStart,
  onLongPressEnd,
  onToggleCheck,
  onRename,
  onDelete,
  onMove,
  onCopy,
  onDownload,
  onShare,
  onPreview,
  onTransfer,
}: FileRowProps) {
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const rowRef = useRef<HTMLDivElement>(null);
  const FileIcon = getFileIcon(file);
  const iconColor = getIconColor(file);

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPressStart(file);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  return (
    <div
      ref={rowRef}
      className={`file-row group relative flex items-center gap-2.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
        isSelected ? "bg-white/5" : ""
      }`}
      style={{
        background: isChecked ? "rgba(99,211,135,0.08)" : isSelected ? "var(--bg-2)" : "transparent",
        borderLeft: isChecked ? "2px solid #63d387" : "2px solid transparent",
      }}
      onClick={() => {
        if (isSelectMode) {
          onToggleCheck(file);
        } else {
          onSingleClick(file);
        }
      }}
      onDoubleClick={() => onDoubleClick(file)}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Checkbox (select mode) */}
      {isSelectMode && (
        <div
          className={`w-4 h-4 rounded flex items-center justify-center transition-colors`}
          style={{
            background: isChecked ? "#63d387" : "var(--bg-2)",
            border: `1px solid ${isChecked ? "#63d387" : "var(--border)"}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck(file);
          }}
        >
          {isChecked && <Check size={10} style={{ color: "#0a0c10" }} strokeWidth={3} />}
        </div>
      )}

      {/* File icon */}
      <div className="w-7 flex justify-center">
        <FileIcon size={18} style={{ color: iconColor }} strokeWidth={1.5} />
      </div>

      {/* File name */}
      <div className="flex-1 text-sm truncate" style={{ color: "var(--text-1)" }}>
        {file.name}
      </div>

      {/* Size */}
      <div className="hidden sm:block text-xs w-16 text-right font-mono" style={{ color: "var(--text-3)" }}>
        {file.type === "folder" ? "—" : formatBytes(file.size)}
      </div>

      {/* Modified date */}
      <div className="hidden md:block text-xs w-20 text-right" style={{ color: "var(--text-3)" }}>
        {formatDate(file.modified_at)}
      </div>

      {/* Action buttons */}
      <div className="w-28 flex justify-end gap-0.5">
        {showActions && !isSelectMode && (
          <>
            <ActionButton icon={Eye} onClick={() => onPreview(file)} title="Preview" />
            <ActionButton icon={Download} onClick={() => onDownload(file)} title="Download" />
            <ActionButton icon={Share2} onClick={() => onShare(file)} title="Share" />
            <ActionButton icon={Move} onClick={() => onMove(file)} title="Move" />
            <ActionButton icon={Copy} onClick={() => onCopy(file)} title="Copy" />
            <ActionButton icon={Cloud} onClick={() => onTransfer(file)} title="Transfer to another account" />
            <ActionButton icon={Edit2} onClick={() => onRename(file)} title="Rename" />
            <ActionButton icon={Trash2} onClick={() => onDelete(file)} title="Delete" danger />
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, onClick, title, danger = false }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="p-1 rounded transition-colors hover:bg-white/10"
      title={title}
    >
      <Icon size={14} style={{ color: danger ? "#f87171" : "var(--text-3)" }} />
    </button>
  );
}
