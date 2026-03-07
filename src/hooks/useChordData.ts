import { useState, useEffect, useCallback } from "react";
import { resolveChordVoicing, type Instrument } from "@/lib/chord-diagrams";
import { supabase } from "@/integrations/supabase/client";

/**
 * Standardized chord data interface — the contract between
 * the local DB, the AI engine, and the SVG renderer.
 */
export interface ChordData {
  baseFret: number;
  frets: (number | -1)[];
  fingers: number[];
  barres: { fret: number; from: number; to: number }[];
}

interface UseChordDataResult {
  chordData: ChordData | null;
  loading: boolean;
  source: "local" | "cache" | "ai" | null;
  simplified: boolean;
  error: string | null;
}

// In-memory session cache to avoid redundant network calls
const sessionCache = new Map<string, { data: ChordData; source: "cache" | "ai" }>();

/**
 * Resolves chord voicing data with a 3-tier fallback:
 * 1. Local static dictionary (instant, offline)
 * 2. Supabase ai_generated_chords cache (fast network)
 * 3. AI generation via Edge Function (slow, cached for future)
 */
export function useChordData(
  chordName: string | null,
  instrument: Instrument
): UseChordDataResult {
  const [chordData, setChordData] = useState<ChordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "cache" | "ai" | null>(null);
  const [simplified, setSimplified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    if (!chordName || instrument === "keyboard") {
      setChordData(null);
      setSource(null);
      setLoading(false);
      return;
    }

    setError(null);

    // ── Tier 1: Local static dictionary ──
    const local = resolveChordVoicing(chordName, instrument);
    if (local.voicing) {
      setChordData({
        baseFret: local.voicing.baseFret || 1,
        frets: local.voicing.frets,
        fingers: [],
        barres: local.voicing.barres || [],
      });
      setSource("local");
      setSimplified(local.simplified);
      setLoading(false);
      return;
    }

    // ── Check session cache ──
    const cacheKey = `${chordName}::${instrument}`;
    const sessionHit = sessionCache.get(cacheKey);
    if (sessionHit) {
      setChordData(sessionHit.data);
      setSource(sessionHit.source);
      setSimplified(false);
      setLoading(false);
      return;
    }

    // ── Tier 2 + 3: Network (cache then AI) ──
    setLoading(true);

    try {
      // Try DB cache first
      const { data: cached } = await supabase
        .from("ai_generated_chords")
        .select("chord_data")
        .eq("chord_name", chordName)
        .eq("instrument", instrument)
        .maybeSingle();

      if (cached?.chord_data) {
        const data = cached.chord_data as unknown as ChordData;
        sessionCache.set(cacheKey, { data, source: "cache" });
        setChordData(data);
        setSource("cache");
        setSimplified(false);
        setLoading(false);
        return;
      }

      // Tier 3: AI generation
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "generate-chord-voicing",
        { body: { chordName, instrument } }
      );

      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);

      if (fnData?.chord_data) {
        const data = fnData.chord_data as ChordData;
        sessionCache.set(cacheKey, { data, source: "ai" });
        setChordData(data);
        setSource("ai");
        setSimplified(false);
      } else {
        setChordData(null);
        setSource(null);
      }
    } catch (e) {
      console.error("useChordData AI fallback error:", e);
      setError(e instanceof Error ? e.message : "Erro ao gerar acorde");
      setChordData(null);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [chordName, instrument]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { chordData, loading, source, simplified, error };
}
