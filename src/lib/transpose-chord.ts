const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteIndex(note: string): number {
  let idx = NOTES_SHARP.indexOf(note);
  if (idx === -1) idx = NOTES_FLAT.indexOf(note);
  return idx;
}

/** Returns the root note of a key string, e.g. "Am" → "A", "F#m" → "F#" */
function rootOf(key: string): string {
  if (key.length >= 2 && (key[1] === "#" || key[1] === "b")) return key.slice(0, 2);
  return key.slice(0, 1);
}

/**
 * Transpose a single chord from `fromKey` to `toKey`.
 * e.g. transposeChord("G", "G", "A") → "A"
 *      transposeChord("C", "G", "A") → "D"
 */
export function transposeChord(chord: string, fromKey: string, toKey: string): string {
  if (!chord || !fromKey || !toKey || fromKey === toKey) return chord;

  const fromRoot = rootOf(fromKey);
  const toRoot = rootOf(toKey);
  const fromIdx = noteIndex(fromRoot);
  const toIdx = noteIndex(toRoot);
  if (fromIdx === -1 || toIdx === -1) return chord;

  const semitones = ((toIdx - fromIdx) % 12 + 12) % 12;
  if (semitones === 0) return chord;

  const useFlats = toRoot.includes("b");

  // Match chord root (e.g. "F#m7" → root="F#", rest="m7")
  const match = chord.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chord;

  const chordRoot = match[1];
  const quality = match[2]; // e.g. "m7", "7M", "sus4", etc.

  const idx = noteIndex(chordRoot);
  if (idx === -1) return chord;

  const newIdx = (idx + semitones) % 12;
  const newRoot = useFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];

  return newRoot + quality;
}
