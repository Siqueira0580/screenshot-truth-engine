import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];

const THROTTLE_MS = 2000;

export function useAutoEnrichment(songs: Song[] | undefined) {
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const processedIdsRef = useRef<Set<string>>(new Set());

  const getQueue = useCallback((): Song[] => {
    if (!songs) return [];
    return songs.filter(
      (s) =>
        s.artist &&
        !processedIdsRef.current.has(s.id) &&
        s.enrichment_status !== "done" &&
        s.enrichment_status !== "failed" &&
        (!s.style || !s.bpm)
    );
  }, [songs]);

  useEffect(() => {
    const queue = getQueue();
    if (queue.length === 0 || processingRef.current) return;

    processingRef.current = true;

    const processQueue = async () => {
      for (const song of queue) {
        if (processedIdsRef.current.has(song.id)) continue;
        processedIdsRef.current.add(song.id);

        try {
          const { data, error } = await supabase.functions.invoke("enrich-song", {
            body: {
              song_id: song.id,
              artist: song.artist,
              current_style: song.style,
            },
          });

          if (!error && data) {
            // Update React Query cache silently
            queryClient.setQueryData<Song[]>(["songs"], (old) => {
              if (!old) return old;
              return old.map((s) =>
                s.id === song.id
                  ? {
                      ...s,
                      style: data.style || s.style,
                      enrichment_status: "done",
                    }
                  : s
              ) as Song[];
            });
          }
        } catch (e) {
          console.warn(`Enrichment failed for song ${song.id}:`, e);
        }

        // Throttle: wait 2s between each call
        await new Promise((r) => setTimeout(r, THROTTLE_MS));
      }
      processingRef.current = false;
    };

    processQueue();
  }, [songs, getQueue, queryClient]);
}
