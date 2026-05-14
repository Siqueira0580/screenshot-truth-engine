import { useCallback, useEffect, useState } from "react";

const COOLDOWN_MS = 60_000;
const STORAGE_PREFIX = "ai-cooldown:";

function readUntil(key: string): number {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + key);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Cooldown timer shared via localStorage. Trigger via `start429()` when
 * the AI Gateway returns 429. Components show `secondsLeft` and disable
 * actions while `isCoolingDown` is true.
 */
export function useAiCooldown(key: string, durationMs = COOLDOWN_MS) {
  const [until, setUntil] = useState<number>(() => readUntil(key));
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setUntil(readUntil(key));
  }, [key]);

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + key) setUntil(readUntil(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const start429 = useCallback(
    (ms = durationMs) => {
      const next = Date.now() + ms;
      try {
        localStorage.setItem(STORAGE_PREFIX + key, String(next));
      } catch {
        /* ignore */
      }
      setUntil(next);
      setNow(Date.now());
    },
    [key, durationMs],
  );

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  const isCoolingDown = secondsLeft > 0;

  /** Inspect a Supabase functions.invoke error/data and start cooldown if 429. */
  const handleInvokeResult = useCallback(
    (error: any, data: any): boolean => {
      const status =
        error?.context?.response?.status ??
        error?.status ??
        (typeof data?.error === "string" && /429|muitas requisi/i.test(data.error) ? 429 : undefined);
      if (status === 429) {
        start429();
        return true;
      }
      return false;
    },
    [start429],
  );

  return { isCoolingDown, secondsLeft, start429, handleInvokeResult };
}
