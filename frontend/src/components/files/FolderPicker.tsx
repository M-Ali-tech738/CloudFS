"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, Loader2 } from "lucide-react";
import type { FileModel } from "@/types";
import { files as filesApi } from "@/lib/api";

interface FolderPickerProps {
  accountId?: string | null;
  selectedId: string | null;
  onSelect: (folderId: string, folderName: string) => void;
  excludeId?: string; // Don't allow selecting this folder (for move operations)
}

interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
  isLoading?: boolean;
  expanded?: boolean;
}

export function FolderPicker({ accountId, selectedId, onSelect, excludeId }: FolderPickerProps) {
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Load root folders on mount or account change
  useEffect(() => {
    const loadRootFolders = async () => {
      setLoading(true);
      try {
        // In a real implementation, this would fetch folders from the API
        // For now, create mock folders
        const mockFolders: FolderNode[] = [
          { id: "root", name: "My Drive", children: [] },
          { id: "shared", name: "Shared with me", children: [] },
        ];
        setRootFolders(mockFolders);
        
        // Auto-expand if selected folder is in root
        if (selectedId === "root") {
          setExpandedFolders(new Set(["root"]));
        }
      } catch (error) {
        console.error("Failed to load folders:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRootFolders();
  }, [accountId, selectedId]);

  const loadSubfolders = async (folderId: string) => {
    // Mark as loading
    setRootFolders(prev => updateFolderInTree(prev, folderId, { isLoading: true }));

    try {
      // In real implementation, fetch subfolders from API
      // For now, create mock subfolders
      const mockSubfolders: FolderNode[] = [
        { id: `${folderId}-sub1`, name: "Documents", children: [] },
        { id: `${folderId}-sub2`, name: "Images", children: [] },
        { id: `${folderId}-sub3`, name: "Projects", children: [] },
      ];

      setRootFolders(prev => updateFolderInTree(prev, folderId, {
        children: mockSubfolders,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to load subfolders:", error);
      setRootFolders(prev => updateFolderInTree(prev, folderId, { isLoading: false }));
    }
  };

  const toggleFolder = (folderId: string, hasChildren: boolean) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
        if (hasChildren) {
          loadSubfolders(folderId);
        }
      }
      return next;
    });
  };

  const updateFolderInTree = (nodes: FolderNode[], folderId: string, updates: Partial<FolderNode>): FolderNode[] => {
    return nodes.map(node => {
      if (node.id === folderId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return { ...node, children: updateFolderInTree(node.children, folderId, updates) };
      }
      return node;
    });
  };

  const renderFolder = (folder: FolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedId === folder.id;
    const isDisabled = folder.id === excludeId;
    const hasChildren = folder.children !== undefined;

    return (
      <div key={folder.id} style={{ marginLeft: depth * 16 }}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors ${
            isDisabled ? "opacity-40 cursor-not-allowed" : ""
          }`}
          style={{
            background: isSelected ? "rgba(99,211,135,0.1)" : "transparent",
          }}
          onClick={() => {
            if (!isDisabled) {
              onSelect(folder.id, folder.name);
            }
          }}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) {
                  toggleFolder(folder.id, hasChildren);
                }
              }}
              className="p-0.5 rounded hover:bg-white/5"
              disabled={isDisabled}
            >
              {isExpanded ? (
                <ChevronDown size={14} style={{ color: "var(--text-3)" }} />
              ) : (
                <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Folder icon */}
          <Folder
            size={14}
            style={{
              color: isSelected ? "#63d387" : "var(--text-3)",
            }}
          />

          {/* Folder name */}
          <span
            className="text-sm truncate flex-1"
            style={{
              color: isSelected ? "#63d387" : "var(--text-2)",
            }}
          >
            {folder.name}
          </span>

          {/* Loading indicator */}
          {folder.isLoading && (
            <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-3)" }} />
          )}
        </div>

        {/* Children */}
        {isExpanded && folder.children && folder.children.length > 0 && (
          <div className="mt-0.5">
            {folder.children.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={16} className="animate-spin mr-2" style={{ color: "var(--text-3)" }} />
        <span className="text-xs text-text-muted">Loading folders...</span>
      </div>
    );
  }

  return (
    <div
      className="max-h-64 overflow-y-auto rounded p-1"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
    >
      {rootFolders.map(folder => renderFolder(folder))}
    </div>
  );
}
