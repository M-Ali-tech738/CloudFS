"use client";
import { CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "warn";
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const configs = {
    success: { icon: CheckCircle, bg: "bg-green-950 border-green-800", text: "text-green-300", iconColor: "text-green-400" },
    error: { icon: XCircle, bg: "bg-red-950 border-red-800", text: "text-red-300", iconColor: "text-red-400" },
    warn: { icon: AlertTriangle, bg: "bg-yellow-950 border-yellow-800", text: "text-yellow-300", iconColor: "text-yellow-400" },
  };
  const { icon: Icon, bg, text, iconColor } = configs[type];

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl ${bg} max-w-sm w-full mx-4`}>
      <Icon size={16} className={iconColor} />
      <p className={`text-sm flex-1 ${text}`}>{message}</p>
      <button onClick={onClose} className="text-text-muted hover:text-text-primary">
        <X size={14} />
      </button>
    </div>
  );
}
