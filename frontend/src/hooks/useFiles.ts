import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { files as filesApi, CloudFSApiError } from "@/lib/api";
import type { FileList, FileModel } from "@/types";

export function useFiles(folderId = "root") {
  const cacheKey = `/files/${folderId}`;
  const { data, error, isLoading, mutate: revalidate } = useSWR<FileList, CloudFSApiError>(
    cacheKey,
    () => filesApi.list(folderId),
    { revalidateOnFocus: false }
  );

  const deleteFile = useCallback(async (file: FileModel) => {
    await filesApi.delete(file.id, file.etag);
    await revalidate();
  }, [revalidate]);

  const renameFile = useCallback(async (file: FileModel, newName: string) => {
    try {
      await filesApi.rename(file.id, newName, file.etag);
      await revalidate();
    } catch (err) {
      if (err instanceof CloudFSApiError && err.code === "CONFLICT_STALE_VERSION") {
        const fresh = await filesApi.get(file.id);
        await filesApi.rename(fresh.id, newName, fresh.etag);
        await revalidate();
      } else throw err;
    }
  }, [revalidate]);

  const moveFile = useCallback(async (file: FileModel, destinationFolderId: string) => {
    await filesApi.move(file.id, destinationFolderId, file.etag);
    await revalidate();
  }, [revalidate]);

  const copyFile = useCallback(async (file: FileModel, destinationFolderId: string, newName?: string) => {
    await filesApi.copy(file.id, destinationFolderId, newName);
    await revalidate();
  }, [revalidate]);

  const uploadFile = useCallback(async (file: File) => {
    await filesApi.upload(file, folderId);
    await revalidate();
  }, [folderId, revalidate]);

  const createFolder = useCallback(async (name: string) => {
    await filesApi.createFolder(name, folderId);
    await revalidate();
  }, [folderId, revalidate]);

  const shareFile = useCallback(async (file: FileModel) => {
    return await filesApi.share(file.id);
  }, []);

  const bulkDelete = useCallback(async (selectedFiles: FileModel[]) => {
    const fileIds = selectedFiles.map((f) => f.id);
    const etags = Object.fromEntries(selectedFiles.map((f) => [f.id, f.etag]));
    const result = await filesApi.bulkDelete(fileIds, etags);
    await revalidate();
    return result;
  }, [revalidate]);

  const bulkMove = useCallback(async (selectedFiles: FileModel[], destinationFolderId: string) => {
    const fileIds = selectedFiles.map((f) => f.id);
    const etags = Object.fromEntries(selectedFiles.map((f) => [f.id, f.etag]));
    const result = await filesApi.bulkMove(fileIds, destinationFolderId, etags);
    await revalidate();
    return result;
  }, [revalidate]);

  return {
    files: data?.files ?? [],
    nextPageToken: data?.next_page_token,
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
    revalidate,
  };
}
