import { errorMessage } from "@/lib/text";
import { useMemo, useState } from "react";
import type { DbItem } from "@/app/types";
import { apiFetch } from "@/app/apiFetch";

export type LibraryCounts = { total: number; music: number; books: number; movies: number };

export function useItems() {
  const [items, setItems] = useState<DbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const { res, json } = await apiFetch("/api/items");
      if (!res.ok) {
        setLibraryError(json?.error ?? "Ошибка загрузки");
        setItems([]);
        return;
      }
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e) {
      setLibraryError(errorMessage(e, "Network error"));
    } finally {
      setLibraryLoading(false);
    }
  }

  const counts = useMemo(() => ({
    total: items.length,
    music: items.filter((i) => i.type === "music").length,
    books: items.filter((i) => i.type === "book").length,
    movies: items.filter((i) => i.type === "movie").length,
  }), [items]);

  return {
    items, setItems, libraryLoading, libraryError, setLibraryError, setLibraryLoading,
    loadLibrary, counts,
    countsUnknown: libraryLoading && items.length === 0,
  };
}
