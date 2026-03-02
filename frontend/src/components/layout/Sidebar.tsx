"use client";

import { useState, useEffect } from "react";
import {
  Home,
  Clock,
  Star,
  Share2,
  Trash2,
  HardDrive,
  Users,
  Laptop,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Settings,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";
import type { NavSection, ConnectedAccount, StorageQuota } from "@/types";
import { formatBytes } from "@/lib/utils";

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection, folderId?: string) => void;
  accounts: ConnectedAccount[];
  activeAccountId: string | null;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: () => void;
  storageQuota?: StorageQuota | null;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

function StorageMeter({ quota }: { quota: StorageQuota }) {
  const usagePercent = (quota.usage / quota.limit) * 100;
  const isNearLimit = usagePercent > 85;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "var(--text-3)" }}>Storage</span>
        <span style={{ color: isNearLimit ? "#f87171" : "var(--text-2)" }}>
          {formatBytes(quota.usage)} / {formatBytes(quota.limit)}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(usagePercent, 100)}%`,
            background: isNearLimit ? "#f87171" : "#63d387",
          }}
        />
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  section,
  activeSection,
  onClick,
  indent = false,
  badge,
}: {
  icon: any;
  label: string;
  section: NavSection;
  activeSection: NavSection;
  onClick: () => void;
  indent?: boolean;
  badge?: string | number;
}) {
  const isActive = activeSection === section;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm rounded transition-all ${
        indent ? "ml-4" : ""
      }`}
      style={{
        background: isActive ? "rgba(99,211,135,0.1)" : "transparent",
        color: isActive ? "#63d387" : "var(--text-2)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "var(--bg-2)";
          e.currentTarget.style.color = "var(--text-1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-2)";
        }
      }}
    >
      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  activeSection,
  onNavigate,
  accounts,
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  storageQuota,
  isMobile = false,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const [myDriveExpanded, setMyDriveExpanded] = useState(true);
  const [sharedDrivesExpanded, setSharedDrivesExpanded] = useState(false);

  // Mock folders for My Drive tree (in real app, fetch from API)
  const [myDriveFolders, setMyDriveFolders] = useState([
    { id: "folder1", name: "Documents" },
    { id: "folder2", name: "Images" },
    { id: "folder3", name: "Projects" },
  ]);

  // Mock shared drives
  const [sharedDrives, setSharedDrives] = useState([
    { id: "drive1", name: "Team Drive" },
    { id: "drive2", name: "Client Projects" },
  ]);

  // Handle escape key for mobile
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMobile, isOpen, onClose]);

  const content = (
    <div className="flex flex-col h-full">
      {/* Header with close button on mobile */}
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-mono text-sm font-semibold text-text-secondary">CloudFS</span>
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
          onDisconnectAccount={(id) => console.log("Disconnect", id)}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        <NavItem
          icon={Home}
          label="Home"
          section="home"
          activeSection={activeSection}
          onClick={() => onNavigate("home")}
        />
        <NavItem
          icon={Clock}
          label="Recent"
          section="recent"
          activeSection={activeSection}
          onClick={() => onNavigate("recent")}
        />
        <NavItem
          icon={Star}
          label="Starred"
          section="starred"
          activeSection={activeSection}
          onClick={() => onNavigate("starred")}
        />
        <NavItem
          icon={Share2}
          label="Shared with me"
          section="shared"
          activeSection={activeSection}
          onClick={() => onNavigate("shared")}
        />
        <NavItem
          icon={Trash2}
          label="Trash"
          section="trash"
          activeSection={activeSection}
          onClick={() => onNavigate("trash")}
        />

        <div className="my-2 border-t" style={{ borderColor: "var(--border)" }} />

        {/* My Drive with expandable folders */}
        <div>
          <button
            onClick={() => setMyDriveExpanded(!myDriveExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
            style={{ color: "var(--text-3)" }}
          >
            {myDriveExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>My Drive</span>
          </button>
          
          {myDriveExpanded && (
            <div className="mt-1 space-y-0.5">
              {myDriveFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => onNavigate("my-drive", folder.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-all ml-4"
                  style={{
                    color: "var(--text-2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-2)";
                    e.currentTarget.style.color = "var(--text-1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-2)";
                  }}
                >
                  <Folder size={14} style={{ color: "var(--text-3)" }} />
                  <span className="flex-1 text-left">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shared Drives */}
        <div>
          <button
            onClick={() => setSharedDrivesExpanded(!sharedDrivesExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
            style={{ color: "var(--text-3)" }}
          >
            {sharedDrivesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>Shared drives</span>
          </button>
          
          {sharedDrivesExpanded && (
            <div className="mt-1 space-y-0.5">
              {sharedDrives.map((drive) => (
                <button
                  key={drive.id}
                  onClick={() => onNavigate("drives", drive.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-all ml-4"
                  style={{
                    color: "var(--text-2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-2)";
                    e.currentTarget.style.color = "var(--text-1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-2)";
                  }}
                >
                  <Users size={14} style={{ color: "var(--text-3)" }} />
                  <span className="flex-1 text-left">{drive.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <NavItem
          icon={Laptop}
          label="Computers"
          section="computers"
          activeSection={activeSection}
          onClick={() => onNavigate("computers")}
        />

        <div className="my-2 border-t" style={{ borderColor: "var(--border)" }} />

        <NavItem
          icon={HardDrive}
          label="Storage"
          section="storage"
          activeSection={activeSection}
          onClick={() => onNavigate("storage")}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          section="storage" // Temporary, not a real section
          activeSection={activeSection}
          onClick={() => {}}
        />
        <NavItem
          icon={HelpCircle}
          label="Help"
          section="storage" // Temporary, not a real section
          activeSection={activeSection}
          onClick={() => {}}
        />
      </nav>

      {/* Storage meter */}
      {storageQuota && <StorageMeter quota={storageQuota} />}

      {/* Footer with upgrade link */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          className="w-full text-xs py-1.5 rounded transition-colors"
          style={{
            background: "rgba(99,211,135,0.05)",
            border: "1px solid rgba(99,211,135,0.15)",
            color: "#63d387",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(99,211,135,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(99,211,135,0.05)";
          }}
        >
          Get more storage
        </button>
      </div>
    </div>
  );

  // Mobile sidebar with overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
        )}
        
        {/* Sidebar panel */}
        <div
          className={`fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "var(--bg-1)", borderRight: "1px solid var(--border)" }}
        >
          {content}
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className="w-64 h-full overflow-hidden flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
      {content}
    </div>
  );
}
