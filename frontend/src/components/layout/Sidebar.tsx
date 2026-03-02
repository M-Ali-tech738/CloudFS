"use client";

import { useState, useEffect } from "react";
import {
  Home, Clock, Star, Share2, Trash2, HardDrive,
  Users, ChevronRight, ChevronDown, Folder, X, LucideIcon,
} from "lucide-react";
import type { NavSection, ConnectedAccount, StorageQuota } from "@/types";
import { formatBytes } from "@/lib/utils";
import { AccountSwitcher } from "./AccountSwitcher";

interface SidebarFolder {
  id: string;
  name: string;
}

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection, folderId?: string) => void;
  accounts: ConnectedAccount[];
  activeAccountId: string | null;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onDisconnectAccount: (accountId: string) => void;
  storageQuota?: StorageQuota | null;
  myDriveFolders?: SidebarFolder[];
  sharedDrives?: SidebarFolder[];
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

function StorageMeter({ quota }: { quota: StorageQuota }) {
  const pct = (quota.usage / quota.limit) * 100;
  const nearLimit = pct > 85;
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "var(--text-3)" }}>Storage</span>
        <span style={{ color: nearLimit ? "#f87171" : "var(--text-2)" }}>
          {formatBytes(quota.usage)} / {formatBytes(quota.limit)}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: nearLimit ? "#f87171" : "#63d387" }}
        />
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon, label, section, activeSection, onClick, badge,
}: {
  icon: LucideIcon;
  label: string;
  section: NavSection;
  activeSection: NavSection;
  onClick: () => void;
  badge?: string | number;
}) {
  const isActive = activeSection === section;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm rounded transition-all"
      style={{
        background: isActive ? "rgba(99,211,135,0.1)" : "transparent",
        color: isActive ? "#63d387" : "var(--text-2)",
      }}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.color = "var(--text-1)"; } }}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; } }}
    >
      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  activeSection, onNavigate,
  accounts, activeAccountId, onSwitchAccount, onAddAccount, onDisconnectAccount,
  storageQuota,
  myDriveFolders = [],
  sharedDrives = [],
  isMobile = false, isOpen = false, onClose,
}: SidebarProps) {
  const [myDriveExpanded, setMyDriveExpanded] = useState(true);
  const [sharedDrivesExpanded, setSharedDrivesExpanded] = useState(false);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobile, isOpen, onClose]);

  const content = (
    <div className="flex flex-col h-full">
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-mono text-sm font-semibold" style={{ color: "var(--text-2)" }}>CLOUDFS</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5">
            <X size={18} style={{ color: "var(--text-3)" }} />
          </button>
        </div>
      )}

      {/* Account switcher */}
      <div className="p-3">
        <AccountSwitcher
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSwitchAccount={onSwitchAccount}
          onAddAccount={onAddAccount}
          onDisconnectAccount={onDisconnectAccount}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <NavItem icon={Home}   label="Home"          section="home"    activeSection={activeSection} onClick={() => onNavigate("home")} />
        <NavItem icon={Clock}  label="Recent"        section="recent"  activeSection={activeSection} onClick={() => onNavigate("recent")} />
        <NavItem icon={Star}   label="Starred"       section="starred" activeSection={activeSection} onClick={() => onNavigate("starred")} />
        <NavItem icon={Share2} label="Shared with me" section="shared" activeSection={activeSection} onClick={() => onNavigate("shared")} />
        <NavItem icon={Trash2} label="Trash"         section="trash"   activeSection={activeSection} onClick={() => onNavigate("trash")} />

        <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />

        {/* My Drive */}
        <button
          onClick={() => setMyDriveExpanded(!myDriveExpanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--text-3)" }}
        >
          {myDriveExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          My Drive
        </button>
        {myDriveExpanded && (
          <>
            {/* Root of My Drive */}
            <button
              onClick={() => onNavigate("my-drive")}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-all"
              style={{ paddingLeft: "28px", color: activeSection === "my-drive" ? "#63d387" : "var(--text-2)", background: activeSection === "my-drive" ? "rgba(99,211,135,0.1)" : "transparent" }}
              onMouseEnter={(e) => { if (activeSection !== "my-drive") { e.currentTarget.style.background = "var(--bg-2)"; } }}
              onMouseLeave={(e) => { if (activeSection !== "my-drive") { e.currentTarget.style.background = "transparent"; } }}
            >
              <HardDrive size={14} style={{ color: "var(--text-3)" }} />
              <span className="flex-1 text-left">My Drive</span>
            </button>

            {myDriveFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onNavigate("my-drive", folder.id)}
                className="w-full flex items-center gap-2 py-1.5 text-sm rounded transition-all"
                style={{ paddingLeft: "36px", color: "var(--text-2)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.color = "var(--text-1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
              >
                <Folder size={13} style={{ color: "var(--text-3)" }} />
                <span className="flex-1 text-left truncate">{folder.name}</span>
              </button>
            ))}
          </>
        )}

        {/* Shared Drives */}
        {sharedDrives.length > 0 && (
          <>
            <button
              onClick={() => setSharedDrivesExpanded(!sharedDrivesExpanded)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
              style={{ color: "var(--text-3)" }}
            >
              {sharedDrivesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Shared drives
            </button>
            {sharedDrivesExpanded && sharedDrives.map((drive) => (
              <button
                key={drive.id}
                onClick={() => onNavigate("drives", drive.id)}
                className="w-full flex items-center gap-2 py-1.5 text-sm rounded transition-all"
                style={{ paddingLeft: "28px", color: "var(--text-2)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.color = "var(--text-1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}
              >
                <Users size={13} style={{ color: "var(--text-3)" }} />
                <span className="flex-1 text-left truncate">{drive.name}</span>
              </button>
            ))}
          </>
        )}

        <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />

        <NavItem icon={HardDrive} label="Storage" section="storage" activeSection={activeSection} onClick={() => onNavigate("storage")} />
      </nav>

      {/* Storage meter */}
      {storageQuota && <StorageMeter quota={storageQuota} />}

      {/* Upgrade */}
      <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          className="w-full text-xs py-1.5 rounded transition-colors"
          style={{ background: "rgba(99,211,135,0.05)", border: "1px solid rgba(99,211,135,0.15)", color: "#63d387" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,211,135,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(99,211,135,0.05)"; }}
        >
          Get more storage
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
        <div
          className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ background: "var(--bg-1)", borderRight: "1px solid var(--border)" }}
        >
          {content}
        </div>
      </>
    );
  }

  return (
    <div className="w-64 h-full overflow-hidden flex flex-col shrink-0" style={{ borderRight: "1px solid var(--border)" }}>
      {content}
    </div>
  );
}
