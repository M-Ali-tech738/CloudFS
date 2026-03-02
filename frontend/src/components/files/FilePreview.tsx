"use client";
import { X, ExternalLink, Download, Info } from "lucide-react";
import type { FileModel } from "@/types";

interface FilePreviewProps {
  file: FileModel;
  onClose: () => void;
  onDownload: (file: FileModel) => void;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
const EMBED_MIMES = ["application/pdf", "application/vnd.google-apps.document", "application/vnd.google-apps.spreadsheet", "application/vnd.google-apps.presentation"];

function PreviewContent({ file }: { file: FileModel }) {
  const mime = file.mime_type || "";

  if (IMAGE_MIMES.includes(mime) && file.thumbnail_link) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: "var(--bg)" }}>
        <img
          src={file.web_view_link?.replace("/view", "/preview") || file.thumbnail_link}
          alt={file.name}
          className="max-w-full max-h-full object-contain rounded"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
        />
      </div>
    );
  }

  if (EMBED_MIMES.some(m => mime.includes(m.split(".").pop()!)) || mime.includes("google-apps")) {
    const embedUrl = file.web_view_link?.replace("/view", "/preview");
    if (embedUrl) {
      return <iframe src={embedUrl} className="w-full h-full border-0" title={file.name} sandbox="allow-scripts allow-same-origin allow-popups" />;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6 text-center">
      {file.thumbnail_link ? (
        <img src={file.thumbnail_link} alt={file.name} className="max-w-48 rounded-lg" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} />
      ) : (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
          📄
        </div>
      )}
      <div>
        <p className="text-sm text-text-secondary mb-1">Preview unavailable</p>
        <p className="text-xs text-text-muted">Open in Google Drive to view this file</p>
      </div>
    </div>
  );
}

export function FilePreview({ file, onClose, onDownload }: FilePreviewProps) {
  return (
    <div className="flex flex-col h-full animate-slide-right" style={{ background: "var(--bg-1)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="flex-1 text-sm font-medium text-text-primary truncate">{file.name}</p>
        <button onClick={() => onDownload(file)} className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors hover:bg-surface-2" title="Download">
          <Download size={14} />
        </button>
        {file.web_view_link && (
          <a href={file.web_view_link} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors hover:bg-surface-2" title="Open in Drive">
            <ExternalLink size={14} />
          </a>
        )}
        <button onClick={onClose} className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors hover:bg-surface-2">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <PreviewContent file={file} />
      </div>

      {/* Info footer */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: "Type", value: file.mime_type?.split("/").pop()?.replace("vnd.google-apps.", "")?.replace("vnd.openxmlformats-officedocument.", "") || "—" },
            { label: "Size", value: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—" },
            { label: "Modified", value: new Date(file.modified_at as any).toLocaleDateString() },
            { label: "Created", value: new Date(file.created_at as any).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-text-muted mb-0.5">{label}</p>
              <p className="text-xs text-text-secondary truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
