/**
 * ChordPro parser — converts "[C]Letra da [Am]música" into structured segments.
 *
 * Each segment is either:
 *   - A chord+lyric pair: { chord: "C", lyric: "Letra da " }
 *   - A plain lyric:      { chord: null, lyric: "texto sem acorde" }
 *
 * Lines are preserved so the renderer can handle line-breaks.
 */

/** A single token inside a ChordPro line */
export interface ChordProToken {
  /** The chord name or null when there is no chord above this text */
  chord: string | null;
  /** The lyric text that follows the chord (may be empty) */
  lyric: string;
}

/** One parsed line */
export interface ChordProLine {
  tokens: ChordProToken[];
}

// Regex that captures everything inside brackets as a chord marker
const CHORDPRO_RE = /\[([^\]]+)\]/g;

/** Regex to detect ChordPro directive lines like {title: ...} */
const _DIRECTIVE_RE = /^\s*\{[^}]+\}\s*$/;

/**
 * Returns true if the text contains ChordPro chord markers like [Am].
 */
export function isChordProFormat(text: string): boolean {
  return CHORDPRO_RE.test(text);
}

/**
 * Parse a full ChordPro string into an array of lines,
 * each containing an array of chord/lyric tokens.
 * Automatically filters out metadata directives like {title:...}.
 */
export function parseChordPro(text: string): ChordProLine[] {
  if (!text) return [];

  return text.split("\n").map((rawLine) => {
    const tokens: ChordProToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    CHORDPRO_RE.lastIndex = 0;

    while ((match = CHORDPRO_RE.exec(rawLine)) !== null) {
      // Any text before this chord belongs to the previous token (or is a plain segment)
      if (match.index > lastIndex) {
        const textBefore = rawLine.slice(lastIndex, match.index);
        if (tokens.length > 0) {
          // Append to previous token's lyric
          tokens[tokens.length - 1].lyric += textBefore;
        } else {
          tokens.push({ chord: null, lyric: textBefore });
        }
      }

      tokens.push({ chord: match[1], lyric: "" });
      lastIndex = CHORDPRO_RE.lastIndex;
    }

    // Remaining text after the last chord
    if (lastIndex < rawLine.length) {
      const remaining = rawLine.slice(lastIndex);
      if (tokens.length > 0) {
        tokens[tokens.length - 1].lyric += remaining;
      } else {
        tokens.push({ chord: null, lyric: remaining });
      }
    }

    // Empty line
    if (tokens.length === 0) {
      tokens.push({ chord: null, lyric: "" });
    }

    return { tokens };
  });
}

/**
 * Extract all unique chord names from a ChordPro string.
 */
export function extractChordsFromChordPro(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const chords: string[] = [];
  let match: RegExpExecArray | null;

  CHORDPRO_RE.lastIndex = 0;
  while ((match = CHORDPRO_RE.exec(text)) !== null) {
    const chord = match[1];
    if (!seen.has(chord)) {
      seen.add(chord);
      chords.push(chord);
    }
  }
  return chords;
}
