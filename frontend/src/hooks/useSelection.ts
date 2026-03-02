import { useState, useCallback, useRef, useEffect } from "react";
import type { FileModel } from "@/types";

export function useSelection(allFiles: FileModel[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Exit select mode when files change
  useEffect(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, [allFiles]);

  const toggleSelect = useCallback((file: FileModel) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      if (next.size === 0) setIsSelectMode(false);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allFiles.map((f) => f.id)));
  }, [allFiles]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  // Long press handlers for mobile
  const onLongPressStart = useCallback((file: FileModel) => {
    longPressTimer.current = setTimeout(() => {
      setIsSelectMode(true);
      setSelectedIds(new Set([file.id]));
    }, 500);
  }, []);

  const onLongPressEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const selectedFiles = allFiles.filter((f) => selectedIds.has(f.id));
  const hasSelection = selectedIds.size > 0;

  return {
    selectedIds,
    selectedFiles,
    hasSelection,
    isSelectMode,
    setIsSelectMode,
    toggleSelect,
    selectAll,
    clearSelection,
    onLongPressStart,
    onLongPressEnd,
  };
}
