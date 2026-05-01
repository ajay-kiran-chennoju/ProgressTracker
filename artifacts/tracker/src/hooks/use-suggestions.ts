import { useCallback, useRef } from "react";
import { useCurrentUser } from "./use-current-user";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const categoryCache = new Map<string, string[]>();
const itemCache = new Map<string, string[]>();

async function fetchCategorySuggestions(slot: string): Promise<string[]> {
  if (categoryCache.has(slot)) return categoryCache.get(slot)!;
  try {
    const r = await fetch(`${BASE}/api/suggestions/categories?slot=${slot}`);
    if (!r.ok) return [];
    const data: string[] = await r.json();
    categoryCache.set(slot, data);
    return data;
  } catch {
    return [];
  }
}

async function fetchItemSuggestions(categoryId: string): Promise<string[]> {
  if (itemCache.has(categoryId)) return itemCache.get(categoryId)!;
  try {
    const r = await fetch(
      `${BASE}/api/suggestions/items?categoryId=${categoryId}`,
    );
    if (!r.ok) return [];
    const data: string[] = await r.json();
    itemCache.set(categoryId, data);
    return data;
  } catch {
    return [];
  }
}

export function useCategorySuggestions() {
  const { user } = useCurrentUser();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSuggestions = useCallback(
    (
      input: string,
      cb: (suggestions: string[]) => void,
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!input.trim() || !user) {
        cb([]);
        return;
      }
      timerRef.current = setTimeout(async () => {
        const pool = await fetchCategorySuggestions(user.slot);
        const q = input.trim().toLowerCase();
        const prefix = pool.filter((s) => s.toLowerCase().startsWith(q));
        const fuzzy = pool.filter(
          (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q),
        );
        cb([...new Set([...prefix, ...fuzzy])].slice(0, 8));
      }, 300);
    },
    [user],
  );

  const invalidate = useCallback(() => {
    if (user) categoryCache.delete(user.slot);
  }, [user]);

  return { getSuggestions, invalidate };
}

export function useItemSuggestions(categoryId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSuggestions = useCallback(
    (input: string, cb: (suggestions: string[]) => void) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!input.trim()) {
        cb([]);
        return;
      }
      timerRef.current = setTimeout(async () => {
        const pool = await fetchItemSuggestions(categoryId);
        const q = input.trim().toLowerCase();
        const prefix = pool.filter((s) => s.toLowerCase().startsWith(q));
        const fuzzy = pool.filter(
          (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q),
        );
        cb([...new Set([...prefix, ...fuzzy])].slice(0, 8));
      }, 300);
    },
    [categoryId],
  );

  const invalidate = useCallback(() => {
    itemCache.delete(categoryId);
  }, [categoryId]);

  return { getSuggestions, invalidate };
}
