"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, LogOut, Circle } from "lucide-react";
import type { ConnectedAccount } from "@/types";

interface AccountSwitcherProps {
  accounts: ConnectedAccount[];
  activeAccountId: string | null;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onDisconnectAccount: (accountId: string) => void;
  isLoading?: boolean;
}

export function AccountSwitcher({
  accounts,
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  onDisconnectAccount,
  isLoading,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  if (isLoading) {
    return (
      <div className="px-3 py-2 rounded-lg animate-pulse" style={{ background: "var(--bg-2)" }}>
        <div className="h-5 w-24 bg-white/5 rounded"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Active account button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:opacity-80"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        {activeAccount?.avatar_url ? (
          <img
            src={activeAccount.avatar_url}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(99,211,135,0.2)" }}>
            <Circle size={8} style={{ color: "#63d387" }} />
          </div>
        )}
        <span className="flex-1 text-left text-sm truncate">
          {activeAccount?.display_name || activeAccount?.email || "Select account"}
        </span>
        <ChevronDown size={14} style={{ color: "var(--text-3)" }} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          
          {/* Menu */}
          <div
            className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg shadow-xl z-20"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
          >
            {/* Account list */}
            {accounts.map((account) => (
              <div key={account.id} className="relative group">
                <button
                  onClick={() => {
                    onSwitchAccount(account.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-80 transition-colors"
                  style={{ background: account.id === activeAccountId ? "rgba(99,211,135,0.1)" : "transparent" }}
                >
                  {account.avatar_url ? (
                    <img src={account.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(99,211,135,0.2)" }}>
                      <Circle size={8} style={{ color: "#63d387" }} />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-sm truncate">{account.display_name || account.email}</div>
                    <div className="text-xs text-text-muted truncate">{account.email}</div>
                  </div>
                  {account.is_primary && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(99,211,135,0.15)", color: "#63d387" }}>
                      Primary
                    </span>
                  )}
                  {account.id === activeAccountId && (
                    <Check size={14} style={{ color: "#63d387" }} />
                  )}
                </button>
                
                {/* Disconnect button (non-primary accounts only) */}
                {!account.is_primary && (
                  <button
                    onClick={() => {
                      if (confirm(`Disconnect ${account.email}?`)) {
                        onDisconnectAccount(account.id);
                        setIsOpen(false);
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                    title="Disconnect account"
                  >
                    <LogOut size={12} style={{ color: "var(--text-3)" }} />
                  </button>
                )}
              </div>
            ))}

            {/* Add account button */}
            <button
              onClick={() => {
                onAddAccount();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 mt-1 border-t text-left transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Plus size={12} style={{ color: "var(--text-3)" }} />
              </div>
              <span className="text-sm text-text-secondary">Add another account</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
