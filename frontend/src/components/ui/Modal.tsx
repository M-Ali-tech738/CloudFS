"use client";
import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width = "max-w-md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${width} animate-scale-in`}
        style={{
          background: "var(--bg-1)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
