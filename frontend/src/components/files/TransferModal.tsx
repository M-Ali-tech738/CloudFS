"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  X,
  Check,
  AlertCircle,
  Loader2,
  Folder,
  File,
  ChevronDown,
} from "lucide-react";
import type { FileModel, ConnectedAccount, TransferStatus } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { FolderPicker } from "./FolderPicker";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFile: FileModel | null;
  sourceAccount: ConnectedAccount | null;
  accounts: ConnectedAccount[];
  onTransfer: (data: {
    sourceAccountId: string;
    destAccountId: string;
    fileId: string;
    destFolderId: string;
    newName?: string;
    move: boolean;
  }) => Promise<void>;
  transferStatus?: TransferStatus | null;
}

type Step = "select-destination" | "transferring" | "complete" | "error";

export function TransferModal({
  isOpen,
  onClose,
  sourceFile,
  sourceAccount,
  accounts,
  onTransfer,
  transferStatus,
}: TransferModalProps) {
  const [step, setStep] = useState<Step>("select-destination");
  const [destAccountId, setDestAccountId] = useState<string>("");
  const [destFolderId, setDestFolderId] = useState<string>("root");
  const [destFolderName, setDestFolderName] = useState("My Drive");
  const [newName, setNewName] = useState("");
  const [move, setMove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("select-destination");
      setDestAccountId("");
      setDestFolderId("root");
      setDestFolderName("My Drive");
      setNewName(sourceFile?.name || "");
      setMove(false);
      setError(null);
    }
  }, [isOpen, sourceFile]);

  // Filter out source account from destinations
  const destinationAccounts = accounts.filter(
    (acc) => acc.id !== sourceAccount?.id
  );

  const handleTransfer = async () => {
    if (!sourceFile || !sourceAccount || !destAccountId) return;

    setStep("transferring");
    setError(null);

    try {
      await onTransfer({
        sourceAccountId: sourceAccount.id,
        destAccountId,
        fileId: sourceFile.id,
        destFolderId,
        newName: newName !== sourceFile.name ? newName : undefined,
        move,
      });
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
      setStep("error");
    }
  };

  const getStepContent = () => {
    switch (step) {
      case "select-destination":
        return (
          <div className="space-y-4">
            {/* Source file info */}
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-2)" }}>
              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(99,211,135,0.1)" }}>
                <File size={16} style={{ color: "#63d387" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{sourceFile?.name}</div>
                <div className="text-xs text-text-muted">
                  From: {sourceAccount?.email}
                </div>
              </div>
            </div>

            {/* Destination account selector */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>
                Destination account
              </label>
              <select
                value={destAccountId}
                onChange={(e) => setDestAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              >
                <option value="">Select destination account</option>
                {destinationAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.display_name || acc.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination folder picker */}
            {destAccountId && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>
                  Destination folder
                </label>
                <FolderPicker
                  accountId={destAccountId}
                  selectedId={destFolderId}
                  onSelect={(id, name) => {
                    setDestFolderId(id);
                    setDestFolderName(name);
                  }}
                />
              </div>
            )}

            {/* Options */}
            <div className="space-y-3">
              {/* Rename option */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-3)" }}>
                  Rename (optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New name"
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
                />
              </div>

              {/* Move vs Copy toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!move}
                    onChange={() => setMove(false)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-sm">Copy</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={move}
                    onChange={() => setMove(true)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-sm">Move (delete from source)</span>
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded text-sm transition-colors"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!destAccountId}
                className="flex-1 py-2 rounded text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(99,211,135,0.15)", border: "1px solid rgba(99,211,135,0.3)", color: "#63d387" }}
              >
                Start transfer
              </button>
            </div>
          </div>
        );

      case "transferring":
        return (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin" style={{ color: "#63d387" }} />
            <div className="text-center">
              <p className="text-sm font-medium mb-1">Transferring file...</p>
              <p className="text-xs text-text-muted">
                {sourceFile?.name} → {destAccountId && accounts.find(a => a.id === destAccountId)?.email}
              </p>
            </div>
            {transferStatus && (
              <div className="w-full mt-2">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${transferStatus.progress}%`,
                      background: "#63d387",
                    }}
                  />
                </div>
                <p className="text-xs text-center mt-2 text-text-muted">
                  {transferStatus.message || "Transferring..."}
                </p>
              </div>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(99,211,135,0.15)" }}>
              <Check size={24} style={{ color: "#63d387" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1">Transfer complete!</p>
              <p className="text-xs text-text-muted">
                {move ? "Moved" : "Copied"} to destination account
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded text-sm font-medium mt-2"
              style={{ background: "rgba(99,211,135,0.15)", border: "1px solid rgba(99,211,135,0.3)", color: "#63d387" }}
            >
              Done
            </button>
          </div>
        );

      case "error":
        return (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(248,113,113,0.15)" }}>
              <AlertCircle size={24} style={{ color: "#f87171" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1">Transfer failed</p>
              <p className="text-xs text-text-muted">{error || "An error occurred"}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-sm"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
              >
                Close
              </button>
              <button
                onClick={() => setStep("select-destination")}
                className="px-4 py-2 rounded text-sm font-medium"
                style={{ background: "rgba(99,211,135,0.15)", border: "1px solid rgba(99,211,135,0.3)", color: "#63d387" }}
              >
                Try again
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <Modal
      title={`Transfer file${move ? " (move)" : ""}`}
      onClose={onClose}
      isOpen={isOpen}
      width="max-w-md"
    >
      {getStepContent()}
    </Modal>
  );
}
