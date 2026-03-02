"use client";
import { CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "warn";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const configs = {
    success: { icon: CheckCircle, color: "#63d387", bg: "rgba(99,211,135,0.08)", border: "rgba(99,211,135,0.2)" },
    error:   { icon: XCircle,     color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
    warn:    { icon: AlertTriangle,color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
  };
  const { icon: Icon, color, bg, border } = configs[type];

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg animate-fade-in"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        maxWidth: "360px",
        width: "calc(100vw - 32px)",
      }}
    >
      <Icon size={15} style={{ color, flexShrink: 0 }} />
      <p className="text-sm flex-1" style={{ color: "#edf0f7" }}>{message}</p>
      <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}
