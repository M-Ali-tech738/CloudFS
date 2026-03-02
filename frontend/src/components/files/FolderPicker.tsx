"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, Loader2 } from "lucide-react";
import { files as filesApi } from "@/lib/api";

interface FolderPickerProps {
  accountId?: string | null;
  selectedId: string | null;
  onSelect: (folderId: string, folderName: string) => void;
  excludeId?: string;
}

interface FolderNode {
  id: string;
  name: string;
  children: FolderNode[] | null; // null = not yet loaded
  isLoading: boolean;
}

export function FolderPicker({ accountId, selectedId, onSelect, excludeId }: FolderPickerProps) {
  const [root, setRoot] = useState<FolderNode>({ id: "root", name: "My Drive", children: null, isLoading: false });
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchFolders = useCallback(async (folderId: string): Promise<FolderNode[]> => {
    try {
      const result = await filesApi.list(folderId, undefined, accountId || undefined);
      return result.files
        .filter((f) => f.type === "folder")
        .map((f) => ({ id: f.id, name: f.name, children: null, isLoading: false }));
    } catch {
      return [];
    }
  }, [accountId]);

  // Load root folders on mount / account change
  useEffect(() => {
    let cancelled = false;
    setRoot({ id: "root", name: "My Drive", children: null, isLoading: true });
    setExpanded(new Set(["root"]));
    setInitialLoading(true);

    fetchFolders("root").then((children) => {
      if (cancelled) return;
      setRoot({ id: "root", name: "My Drive", children, isLoading: false });
      setInitialLoading(false);
    });

    return () => { cancelled = true; };
  }, [fetchFolders]);

  const updateNode = (targetId: string, updates: Partial<FolderNode>) => {
    setRoot((prev) => applyUpdate(prev, targetId, updates));
  };

  function applyUpdate(node: FolderNode, targetId: string, updates: Partial<FolderNode>): FolderNode {
    if (node.id === targetId) return { ...node, ...updates };
    if (!node.children) return node;
    return { ...node, children: node.children.map((c) => applyUpdate(c, targetId, updates)) };
  }

  const handleToggle = useCallback(async (node: FolderNode) => {
    const isExpanded = expanded.has(node.id);

    if (isExpanded) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(node.id); return s; });
      return;
    }

    setExpanded((prev) => new Set([...prev, node.id]));

    if (node.children === null) {
      updateNode(node.id, { isLoading: true });
      const children = await fetchFolders(node.id);
      updateNode(node.id, { children, isLoading: false });
    }
  }, [expanded, fetchFolders]);

  if (initialLoading) {
    return (
      <div className="flex items-center gap-2 py-4 px-3 text-xs" style={{ color: "var(--text-3)" }}>
        <Loader2 size={13} className="animate-spin" />
        Loading folders…
      </div>
    );
  }

  return (
    <div
      className="max-h-60 overflow-y-auto rounded p-1"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
    >
      <FolderNodeRow
        node={root}
        depth={0}
        selectedId={selectedId}
        excludeId={excludeId}
        expanded={expanded}
        onToggle={handleToggle}
        onSelect={onSelect}
      />
    </div>
  );
}

function FolderNodeRow({
  node, depth, selectedId, excludeId, expanded, onToggle, onSelect,
}: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
  excludeId?: string;
  expanded: Set<string>;
  onToggle: (node: FolderNode) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isExcluded = node.id === excludeId;
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 rounded transition-colors"
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          paddingRight: "8px",
          background: isSelected ? "rgba(99,211,135,0.1)" : "transparent",
          opacity: isExcluded ? 0.4 : 1,
          cursor: isExcluded ? "not-allowed" : "pointer",
        }}
        onClick={() => { if (!isExcluded) onSelect(node.id, node.name); }}
      >
        <button
          className="p-0.5 rounded shrink-0"
          onClick={(e) => { e.stopPropagation(); if (!isExcluded) onToggle(node); }}
          disabled={isExcluded}
        >
          {node.isLoading
            ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-3)" }} />
            : isExpanded
              ? <ChevronDown size={12} style={{ color: "var(--text-3)" }} />
              : <ChevronRight size={12} style={{ color: "var(--text-3)" }} />
          }
        </button>

        <Folder size={13} style={{ color: isSelected ? "#63d387" : "var(--text-3)", flexShrink: 0 }} />

        <span className="text-sm truncate ml-1" style={{ color: isSelected ? "#63d387" : "var(--text-2)" }}>
          {node.name}
        </span>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FolderNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              excludeId={excludeId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
