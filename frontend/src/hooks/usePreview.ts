import { useState, useCallback } from "react";
import type { FileModel } from "@/types";

export function usePreview() {
  const [previewFile, setPreviewFile] = useState<FileModel | null>(null);

  const openPreview = useCallback((file: FileModel) => {
    // Don't preview folders
    if (file.type === "folder") return false;
    setPreviewFile(file);
    return true;
  }, []);

  const closePreview = useCallback(() => setPreviewFile(null), []);

  return { previewFile, openPreview, closePreview };
}
