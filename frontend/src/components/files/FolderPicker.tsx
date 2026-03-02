"use client";
import { useState, useEffect } from "react";
import { Folder, ChevronRight, ChevronDown, Loader } from "lucide-react";
import { files as filesApi, CloudFSApiError } from "@/lib/api";
import type { FileModel } from "@/types";

interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
  isLoaded?: boolean;
  isExpanded?: boolean;
}

interface FolderItemProps {
  node: FolderNode;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  depth: number;
  excludeId?: string;
}

function FolderItem({ node, selectedId, onSelect, depth, excludeId }: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (node.id === excludeId) return null;

  const toggle = async () => {
    if (!isLoaded) {
      setIsLoading(true);
      try {
        const data = await filesApi.list(node.id);
        const folders = data.files.filter((f) => f.type === "folder");
        setChildren(folders.map((f) => ({ id: f.id, name: f.name })));
        setIsLoaded(true);
      } catch { } finally { setIsLoading(false); }
    }
    setIsExpanded((v) => !v);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
          ${selectedId === node.id ? "bg-accent/15 text-accent" : "hover:bg-surface-2 text-text-secondary"}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => { onSelect(node.id, node.name); toggle(); }}
      >
        {isLoading
          ? <Loader size={14} className="animate-spin shrink-0 text-text-muted" />
          : isExpanded
            ? <ChevronDown size={14} className="shrink-0" onClick={(e) => { e.stopPropagation(); toggle(); }} />
            : <ChevronRight size={14} className="shrink-0 text-text-muted" onClick={(e) => { e.stopPropagation(); toggle(); }} />
        }
        <Folder size={14} className="shrink-0 text-accent" />
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {isExpanded && children.map((child) => (
        <FolderItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} excludeId={excludeId} />
      ))}
    </div>
  );
}

interface FolderPickerProps {
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  excludeId?: string;
}

export function FolderPicker({ selectedId, onSelect, excludeId }: FolderPickerProps) {
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    filesApi.list("root").then((data) => {
      const folders = data.files.filter((f) => f.type === "folder");
      setRootFolders(folders.map((f) => ({ id: f.id, name: f.name })));
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface-2">
      {/* My Drive root */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors
          ${selectedId === "root" ? "bg-accent/15 text-accent" : "hover:bg-surface-1 text-text-secondary"}`}
        onClick={() => onSelect("root", "My Drive")}
      >
        <Folder size={14} className="shrink-0 text-accent" />
        <span className="text-sm font-medium">My Drive</span>
      </div>

      <div className="border-t border-border max-h-52 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader size={16} className="animate-spin text-text-muted" />
          </div>
        ) : rootFolders.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No folders found</p>
        ) : (
          rootFolders.map((folder) => (
            <FolderItem key={folder.id} node={folder} selectedId={selectedId} onSelect={onSelect} depth={0} excludeId={excludeId} />
          ))
        )}
      </div>
    </div>
  );
}
