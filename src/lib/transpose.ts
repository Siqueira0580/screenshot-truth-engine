const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Chord regex: matches chords like C, Am, F#m7, Bb/G, Csus4, Ddim, etc.
const CHORD_REGEX = /\b([A-G][#b]?)(m|maj|min|dim|aug|sus|add)?([0-9]?)(\/([A-G][#b]?))?\b/g;

function noteIndex(note: string): number {
  let idx = NOTES_SHARP.indexOf(note);
  if (idx === -1) idx = NOTES_FLAT.indexOf(note);
  return idx;
}

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const idx = noteIndex(note);
  if (idx === -1) return note;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return useFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];
}

export function transposeText(text: string, semitones: number): string {
  if (semitones === 0) return text;
  // Detect if original text uses flats more than sharps
  const flatCount = (text.match(/[A-G]b/g) || []).length;
  const sharpCount = (text.match(/[A-G]#/g) || []).length;
  const useFlats = flatCount > sharpCount;

  return text.replace(CHORD_REGEX, (_match, root, quality, num, slashPart, bassNote) => {
    const newRoot = transposeNote(root, semitones, useFlats);
    const newBass = bassNote ? transposeNote(bassNote, semitones, useFlats) : "";
    return `${newRoot}${quality || ""}${num || ""}${bassNote ? `/${newBass}` : ""}`;
  });
}

export function transposeKey(key: string | null | undefined, semitones: number): string | null {
  if (!key || semitones === 0) return key || null;
  const match = key.match(/^([A-G][#b]?)(.*)/);
  if (!match) return key;
  const flatCount = key.includes("b") ? 1 : 0;
  const newRoot = transposeNote(match[1], semitones, flatCount > 0);
  return `${newRoot}${match[2]}`;
}
