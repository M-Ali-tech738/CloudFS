import useSWR, { mutate } from "swr";
import { auth, getToken, setToken, clearToken, CloudFSApiError } from "@/lib/api";
import type { UserInfo } from "@/types";

let refreshPromise: Promise<boolean> | null = null;

export async function silentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const token = getToken();
      if (!token) return false;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cloudfs.onrender.com";
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.token) { setToken(data.token); return true; }
      return false;
    } catch { return false; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export function useUser() {
  const { data, error, isLoading, mutate: revalidateUser } = useSWR<UserInfo, CloudFSApiError>(
    "/auth/me",
    () => auth.me(),
    {
      revalidateOnFocus: false,
      onError: async (err: CloudFSApiError) => {
        if (err?.code === "AUTH_TOKEN_EXPIRED" || err?.code === "AUTH_TOKEN_INVALID") {
          const refreshed = await silentRefresh();
          if (refreshed) {
            await revalidateUser();
            await mutate(() => true, undefined, { revalidate: true });
          } else {
            clearToken();
          }
        }
      },
    }
  );

  const isUnauthenticated =
    !isLoading && !data &&
    (error?.code === "AUTH_TOKEN_INVALID" || error?.code === "AUTH_TOKEN_EXPIRED" || error?.code === "AUTH_GOOGLE_REVOKED");

  return { user: data, isLoading, isUnauthenticated, error };
}
