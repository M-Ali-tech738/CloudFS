"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isOpen?: boolean;
  width?: string;
}

export function Modal({ title, children, onClose, isOpen = true, width = "max-w-md" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`w-full ${width} rounded-lg animate-in slide-in-from-bottom-4`}
        style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X size={16} style={{ color: "var(--text-3)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
