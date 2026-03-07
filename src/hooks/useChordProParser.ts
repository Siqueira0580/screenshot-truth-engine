import { useMemo } from "react";
import {
  parseChordPro,
  extractChordsFromChordPro,
  type ChordProLine,
} from "@/lib/chordpro-parser";

/**
 * React hook that parses a ChordPro string into structured lines + unique chords.
 */
export function useChordProParser(text: string | null | undefined) {
  const lines = useMemo<ChordProLine[]>(
    () => parseChordPro(text ?? ""),
    [text],
  );

  const uniqueChords = useMemo<string[]>(
    () => extractChordsFromChordPro(text ?? ""),
    [text],
  );

  return { lines, uniqueChords };
}
