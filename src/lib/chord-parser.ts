/**
 * Advanced musical chord parser with high-precision regex.
 * Detects simple chords, sharps/flats, minors, 7ths, diminished,
 * suspended, complex tensions, and slash/inverted bass chords.
 */

// Master regex for musical chord detection
// Matches: C, F#m, G7, Bdim, Asus4, Cmaj7(#11), D/F#, Ebm7b5, etc.
const CHORD_REGEX =
  /\b([A-G][#b]?)(m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add)?(\d{0,2})?((?:(?:#|b|♯|♭)\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(\((?:[#b♯♭]?\d{1,2}[,\s]*)+\))?(\/[A-G][#b]?)?\b/g;

export interface ChordMatch {
  /** Full matched chord string */
  chord: string;
  /** Start index in the original text */
  startIndex: number;
  /** End index in the original text */
  endIndex: number;
}

/**
 * Find all chord occurrences in a text string.
 */
export function findChordsInText(text: string): ChordMatch[] {
  const matches: ChordMatch[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  CHORD_REGEX.lastIndex = 0;

  while ((match = CHORD_REGEX.exec(text)) !== null) {
    const chord = match[0];
    const startIndex = match.index;

    // Filter out false positives: single letter that is part of a word
    const charBefore = startIndex > 0 ? text[startIndex - 1] : " ";
    const charAfter = startIndex + chord.length < text.length ? text[startIndex + chord.length] : " ";

    // Skip if surrounded by word characters (not a standalone chord)
    if (/[a-zà-ú]/i.test(charBefore) && !/[\s\n\r([\-|]/.test(charBefore)) continue;
    if (/[a-hj-zà-ú]/i.test(charAfter)) continue;

    matches.push({
      chord,
      startIndex,
      endIndex: startIndex + chord.length,
    });
  }

  return matches;
}

export interface TextSegment {
  type: "text" | "chord";
  content: string;
}

/**
 * Parse text into segments of plain text and chords.
 * Used for rendering chord-highlighted text with React components.
 */
/**
 * Extract all unique chord names from a text string (no duplicates).
 */
export function extractUniqueChords(text: string): string[] {
  const chords = findChordsInText(text);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of chords) {
    if (!seen.has(c.chord)) {
      seen.add(c.chord);
      unique.push(c.chord);
    }
  }
  return unique;
}

export function parseChordsInText(text: string): TextSegment[] {
  const chords = findChordsInText(text);
  if (chords.length === 0) return [{ type: "text", content: text }];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const chord of chords) {
    // Add text before this chord
    if (chord.startIndex > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, chord.startIndex) });
    }
    segments.push({ type: "chord", content: chord.chord });
    lastIndex = chord.endIndex;
  }

  // Remaining text after last chord
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}
