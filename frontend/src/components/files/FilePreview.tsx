"use client";
import { X, ExternalLink, Download } from "lucide-react";
import { files as filesApi } from "@/lib/api";
import type { FileModel } from "@/types";

interface FilePreviewProps {
  file: FileModel;
  onClose: () => void;
  onDownload: (file: FileModel) => void;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const PDF_MIME = "application/pdf";
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/ogg"];

function PreviewContent({ file }: { file: FileModel }) {
  const mime = file.mime_type || "";

  if (IMAGE_MIMES.includes(mime) && file.thumbnail_link) {
    return (
      <div className="flex items-center justify-center h-full bg-black/20 rounded-lg overflow-hidden">
        <img
          src={file.web_view_link?.replace("/view", "/preview") || file.thumbnail_link}
          alt={file.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  if (mime === PDF_MIME || mime.includes("google-apps.document") || mime.includes("google-apps.spreadsheet") || mime.includes("google-apps.presentation")) {
    const embedUrl = file.web_view_link?.replace("/view", "/preview");
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full rounded-lg border-0"
          title={file.name}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      );
    }
  }

  if (VIDEO_MIMES.includes(mime) && file.web_view_link) {
    return (
      <iframe
        src={file.web_view_link.replace("/view", "/preview")}
        className="w-full h-full rounded-lg border-0"
        title={file.name}
        allow="autoplay"
      />
    );
  }

  // Fallback — show thumbnail or generic icon
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      {file.thumbnail_link ? (
        <img src={file.thumbnail_link} alt={file.name} className="max-w-xs rounded-lg shadow" />
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center">
          <span className="text-3xl">📄</span>
        </div>
      )}
      <p className="text-text-muted text-sm text-center max-w-xs">
        Preview not available for this file type.<br />
        Open in Google Drive to view it.
      </p>
    </div>
  );
}

export function FilePreview({ file, onClose, onDownload }: FilePreviewProps) {
  return (
    <div className="flex flex-col h-full bg-surface-1 border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <p className="flex-1 text-sm font-medium text-text-primary truncate">{file.name}</p>
        <button
          onClick={() => onDownload(file)}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
          title="Download"
        >
          <Download size={15} />
        </button>
        {file.web_view_link && (
          <a
            href={file.web_view_link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
            title="Open in Google Drive"
          >
            <ExternalLink size={15} />
          </a>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-hidden p-3">
        <PreviewContent file={file} />
      </div>

      {/* File info footer */}
      <div className="px-4 py-3 border-t border-border shrink-0 grid grid-cols-2 gap-2">
        {[
          { label: "Type", value: file.mime_type?.split("/").pop()?.toUpperCase() || "Unknown" },
          { label: "Size", value: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—" },
          { label: "Modified", value: new Date(file.modified_at as unknown as string).toLocaleDateString() },
          { label: "Created", value: new Date(file.created_at as unknown as string).toLocaleDateString() },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-xs text-text-primary truncate">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
