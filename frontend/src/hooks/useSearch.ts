import { useState, useCallback, useEffect } from "react";
import { files as filesApi } from "@/lib/api";
import type { FileModel } from "@/types";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileModel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    setError(null);
    try {
      const data = await filesApi.search(q);
      setResults(data.files);
    } catch (err: any) {
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => search(query), 400);
    return () => clearTimeout(timer);
  }, [query, search]);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => { setIsOpen(false); setQuery(""); setResults([]); }, []);

  return { query, setQuery, results, isSearching, isOpen, openSearch, closeSearch, error };
}
