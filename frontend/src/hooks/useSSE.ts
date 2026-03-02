import { useEffect, useRef } from "react";
import { mutate } from "swr";
import { createEventSource } from "@/lib/api";
import type { FileModel } from "@/types";

export function useSSE(currentFolderId: string) {
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const es = createEventSource((event) => {
      if (event.type === "change" && event.folder_id === currentFolderId) {
        mutate(`/files/${currentFolderId}`);
      }
    });
    esRef.current = es;
    return () => { es.close(); };
  }, [currentFolderId]);
}

export function useKeyboardNav(
  items: FileModel[],
  selectedIndex: number,
  setSelectedIndex: (i: number) => void,
  onOpen: (file: FileModel) => void
) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (items.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(Math.min(selectedIndex + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(Math.max(selectedIndex - 1, 0)); }
      else if (e.key === "Enter" && selectedIndex >= 0) { e.preventDefault(); onOpen(items[selectedIndex]); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items, selectedIndex, setSelectedIndex, onOpen]);
}
