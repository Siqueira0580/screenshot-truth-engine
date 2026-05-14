import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { transposeKey } from "@/lib/transpose";
import { toast } from "sonner";

const SAVE_DEBOUNCE_MS = 700;

/**
 * Persists per-user transposition for a song so the same transposed key
 * is shown across SongDetail, Study and standalone Teleprompter views.
 *
 * - Loads saved semitones on mount (or 0 if none).
 * - Debounced auto-save on every change (deletes row when back to 0).
 * - Notifies the user when the displayed key differs from the song's original.
 */
export function useSongTransposition(
  songId: string | null | undefined,
  originalKey: string | null | undefined,
  enabled: boolean = true,
) {
  const [transpose, setTransposeState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const lastSavedRef = useRef<number>(0);
  const lastNotifiedRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved value
  useEffect(() => {
    let cancelled = false;
    if (!enabled || !songId) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("user_song_transpositions")
        .select("semitones")
        .eq("user_id", auth.user.id)
        .eq("song_id", songId)
        .maybeSingle();
      if (cancelled) return;
      const v = data?.semitones ?? 0;
      lastSavedRef.current = v;
      lastNotifiedRef.current = v;
      setTransposeState(v);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [songId, enabled]);

  // Debounced save when transpose changes
  useEffect(() => {
    if (!enabled || !loaded || !songId) return;
    if (transpose === lastSavedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const newKey = transposeKey(originalKey ?? null, transpose);
      try {
        if (transpose === 0) {
          await supabase
            .from("user_song_transpositions")
            .delete()
            .eq("user_id", auth.user.id)
            .eq("song_id", songId);
        } else {
          await supabase
            .from("user_song_transpositions")
            .upsert(
              {
                user_id: auth.user.id,
                song_id: songId,
                semitones: transpose,
                transposed_key: newKey,
              },
              { onConflict: "user_id,song_id" },
            );
        }
        lastSavedRef.current = transpose;

        // Notify only when crossing from "no transpose" to "transposed"
        // or when changing the key value, to avoid spam during quick clicks.
        if (transpose !== lastNotifiedRef.current) {
          if (transpose === 0 && originalKey) {
            toast.success(`Tom restaurado para o original (${originalKey}).`);
          } else if (originalKey && newKey) {
            toast.success(
              `Tom alterado de ${originalKey} para ${newKey}. Salvo automaticamente.`,
            );
          } else {
            toast.success("Transposição salva automaticamente.");
          }
          lastNotifiedRef.current = transpose;
        }
      } catch (err) {
        console.error("Failed to save transposition", err);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [transpose, loaded, enabled, songId, originalKey]);

  const setTranspose = useCallback((v: number | ((prev: number) => number)) => {
    setTransposeState((prev) => (typeof v === "function" ? (v as any)(prev) : v));
  }, []);

  return { transpose, setTranspose, loaded };
}
