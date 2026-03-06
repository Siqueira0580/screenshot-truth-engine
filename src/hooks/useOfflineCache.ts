import { useEffect } from "react";

const CACHE_PREFIX = "smartcifra_setlist_";

interface CachedSetlistData {
  setlist: any;
  items: any[];
  cachedAt: number;
}

export function cacheSetlistData(setlistId: string, setlist: any, items: any[]) {
  try {
    const data: CachedSetlistData = { setlist, items, cachedAt: Date.now() };
    localStorage.setItem(`${CACHE_PREFIX}${setlistId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to cache setlist data:", e);
  }
}

export function getCachedSetlistData(setlistId: string): CachedSetlistData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${setlistId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useOfflineCache(setlistId: string | undefined, setlist: any, items: any[]) {
  useEffect(() => {
    if (!setlistId || !setlist || items.length === 0) return;
    cacheSetlistData(setlistId, setlist, items);
  }, [setlistId, setlist, items]);
}
