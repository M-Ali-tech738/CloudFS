import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { files as filesApi, CloudFSApiError } from "@/lib/api";
import type { FileList, FileModel } from "@/types";

interface UseFilesReturn {
  files: FileModel[];
  nextPageToken: string | null;
  isLoading: boolean;
  error: CloudFSApiError | undefined;
  deleteFile: (file: FileModel) => Promise<void>;
  renameFile: (file: FileModel, newName: string) => Promise<void>;
  moveFile: (file: FileModel, destinationFolderId: string) => Promise<void>;
  copyFile: (file: FileModel, destinationFolderId: string, newName?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  shareFile: (file: FileModel) => Promise<{ share_url: string }>;
  bulkDelete: (selectedFiles: FileModel[]) => Promise<{ success: string[]; failed: any[] }>;
  bulkMove: (selectedFiles: FileModel[], destinationFolderId: string) => Promise<{ success: string[]; failed: any[] }>;
  revalidate: () => Promise<void>;
}

export function useFiles(
  folderId?: string, 
  accountId?: string
): UseFilesReturn {
  const effectiveFolderId = folderId || "root";
  
  // Create a cache key that includes both folder and account
  const cacheKey = accountId 
    ? `/files/${accountId}/${effectiveFolderId}`
    : `/files/${effectiveFolderId}`;
  
  const { data, error, isLoading, mutate: revalidateSWR } = useSWR<FileList, CloudFSApiError>(
    cacheKey,
    async () => {
      return filesApi.list(effectiveFolderId, undefined, accountId);
    },
    { revalidateOnFocus: false }
  );

  // Wrap revalidateSWR to match our expected return type
  const revalidate = useCallback(async () => {
    await revalidateSWR();
  }, [revalidateSWR]);

  const deleteFile = useCallback(async (file: FileModel) => {
    await filesApi.delete(file.id, file.etag, accountId);
    await revalidate();
  }, [revalidate, accountId]);

  const renameFile = useCallback(async (file: FileModel, newName: string) => {
    try {
      await filesApi.rename(file.id, newName, file.etag, accountId);
      await revalidate();
    } catch (err) {
      if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
        const fresh = await filesApi.get(file.id, accountId);
        await filesApi.rename(fresh.id, newName, fresh.etag, accountId);
        await revalidate();
      } else throw err;
    }
  }, [revalidate, accountId]);

  const moveFile = useCallback(async (file: FileModel, destinationFolderId: string) => {
    await filesApi.move(file.id, destinationFolderId, file.etag, accountId);
    await revalidate();
  }, [revalidate, accountId]);

  const copyFile = useCallback(async (file: FileModel, destinationFolderId: string, newName?: string) => {
    await filesApi.copy(file.id, destinationFolderId, newName, accountId);
    await revalidate();
  }, [revalidate, accountId]);

  const uploadFile = useCallback(async (file: File) => {
    await filesApi.upload(file, effectiveFolderId, accountId);
    await revalidate();
  }, [effectiveFolderId, revalidate, accountId]);

  const createFolder = useCallback(async (name: string) => {
    await filesApi.createFolder(name, effectiveFolderId, accountId);
    await revalidate();
  }, [effectiveFolderId, revalidate, accountId]);

  const shareFile = useCallback(async (file: FileModel) => {
    return await filesApi.share(file.id, accountId);
  }, [accountId]);

  const bulkDelete = useCallback(async (selectedFiles: FileModel[]) => {
    const fileIds = selectedFiles.map((f) => f.id);
    const etags = Object.fromEntries(selectedFiles.map((f) => [f.id, f.etag]));
    const result = await filesApi.bulkDelete(fileIds, etags, accountId);
    await revalidate();
    return result;
  }, [revalidate, accountId]);

  const bulkMove = useCallback(async (selectedFiles: FileModel[], destinationFolderId: string) => {
    const fileIds = selectedFiles.map((f) => f.id);
    const etags = Object.fromEntries(selectedFiles.map((f) => [f.id, f.etag]));
    const result = await filesApi.bulkMove(fileIds, destinationFolderId, etags, accountId);
    await revalidate();
    return result;
  }, [revalidate, accountId]);

  return {
    files: data?.files ?? [],
    nextPageToken: data?.next_page_token || null,
    isLoading,
    error,
    deleteFile,
    renameFile,
    moveFile,
    copyFile,
    uploadFile,
    createFolder,
    shareFile,
    bulkDelete,
    bulkMove,
    revalidate,  // Now properly typed as () => Promise<void>
  };
}
