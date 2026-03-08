/**
 * Chord diagram data and canvas drawing for Guitar, Cavaquinho, Ukulele, and Keyboard.
 * Includes normalization, enharmonic fallback, and simplification fallback.
 */
import { translateChordBR, getChordLookupChain } from "@/lib/chord-normalizer";

export type Instrument = "guitar" | "cavaquinho" | "ukulele" | "keyboard";

interface ChordVoicing {
  frets: (number | -1)[]; // -1 = muted, 0 = open
  barres?: { fret: number; from: number; to: number }[];
  baseFret?: number;
}

// ─── Enharmonic map ──────────────────────────────────────────────
const ENHARMONIC: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B",
  "C#": "Db", "D#": "Eb", "E#": "F", "F#": "Gb", "G#": "Ab", "A#": "Bb", "B#": "C",
};

/**
 * Normalize a chord name and return the canonical form our DB uses.
 * Handles: Bbm7 → A#m7, min7 → m7, maj → M, etc.
 */
export function normalizeChordName(chord: string): string {
  let c = chord.trim();
  // Normalize unicode accidentals
  c = c.replace(/♯/g, "#").replace(/♭/g, "b");
  // Apply Brazilian notation translation
  c = translateChordBR(c);
  // Normalize quality synonyms
  c = c.replace(/min(?!or)/g, "m");    // min7 → m7
  return c;
}

/**
 * Try to find a voicing with multiple fallback strategies:
 * 1. Exact match
 * 2. Enharmonic root swap  (G#m7 → Abm7 or vice-versa)
 * 3. Simplification: strip tensions progressively (C#m7b5 → C#m7 → C#m → C#)
 * Returns { voicing, displayName, simplified }
 */
export function resolveChordVoicing(
  chord: string,
  instrument: Instrument
): { voicing: ChordVoicing | null; displayName: string; simplified: boolean } {
  if (instrument === "keyboard") return { voicing: null, displayName: chord, simplified: false };

  const db = CHORD_DB[instrument];
  if (!db) return { voicing: null, displayName: chord, simplified: false };

  // Use the BR-aware lookup chain for maximum coverage
  const lookupChain = getChordLookupChain(chord);

  for (const { name, simplified } of lookupChain) {
    // Direct match
    if (db[name]) return { voicing: db[name], displayName: chord, simplified };

    // Enharmonic swap on root
    const rootMatch = name.match(/^([A-G][#b]?)(.*)/);
    if (rootMatch) {
      const [, root, suffix] = rootMatch;
      const alt = ENHARMONIC[root];
      if (alt && db[alt + suffix]) {
        return { voicing: db[alt + suffix], displayName: chord, simplified };
      }
    }
  }

  // Legacy fallback: progressive simplification on the normalized name
  const normalized = normalizeChordName(chord);
  const simplifications = buildSimplifications(normalized);
  for (const simpl of simplifications) {
    if (db[simpl]) return { voicing: db[simpl], displayName: chord, simplified: true };
    const sMatch = simpl.match(/^([A-G][#b]?)(.*)/);
    if (sMatch) {
      const alt = ENHARMONIC[sMatch[1]];
      if (alt && db[alt + sMatch[2]]) {
        return { voicing: db[alt + sMatch[2]], displayName: chord, simplified: true };
      }
    }
  }

  return { voicing: null, displayName: chord, simplified: false };
}

/**
 * Build a list of progressively simpler chord names.
 * E.g. "C#m7b5" → ["C#m7", "C#m", "C#"]
 */
function buildSimplifications(chord: string): string[] {
  const rootMatch = chord.match(/^([A-G][#b]?)(.*)/);
  if (!rootMatch) return [];
  const [, root, quality] = rootMatch;
  const results: string[] = [];

  // Strip parenthetical content: C#m7(b5) → C#m7
  const noParens = quality.replace(/\([^)]*\)/g, "");
  if (noParens !== quality) results.push(root + noParens);

  // Strip slash bass: Am7/G → Am7
  const noSlash = (noParens || quality).replace(/\/[A-G][#b]?$/, "");
  if (noSlash !== noParens) results.push(root + noSlash);

  // Strip tensions like b5, #9, b9, #11, 9, 11, 13
  const noTensions = noSlash.replace(/[#b]?\d{1,2}/g, "");
  if (noTensions !== noSlash && noTensions) results.push(root + noTensions);

  // Strip "add", "sus" suffixes
  const noAdd = noTensions.replace(/(add|sus)\d?/g, "");
  if (noAdd !== noTensions && noAdd) results.push(root + noAdd);

  // Just the quality letter (m, dim, aug)
  const baseQuality = (noAdd || noTensions || noSlash || noParens || quality).match(/^(m|dim|aug)?/)?.[0] || "";
  if (root + baseQuality !== results[results.length - 1]) {
    results.push(root + baseQuality);
  }

  // Just root
  if (!results.includes(root)) results.push(root);

  return results;
}

// Legacy wrapper — still used by some components
export function getChordVoicing(chord: string, instrument: Instrument): ChordVoicing | null {
  return resolveChordVoicing(chord, instrument).voicing;
}

// ─── Comprehensive Chord Database ────────────────────────────────
const CHORD_DB: Record<string, Record<string, ChordVoicing>> = {
  guitar: {
    // === Major ===
    C:    { frets: [-1, 3, 2, 0, 1, 0] },
    "C#": { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Db:   { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    D:    { frets: [-1, -1, 0, 2, 3, 2] },
    "D#": { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
    Eb:   { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
    E:    { frets: [0, 2, 2, 1, 0, 0] },
    F:    { frets: [1, 1, 2, 3, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#": { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gb:   { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    G:    { frets: [3, 2, 0, 0, 0, 3] },
    "G#": { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Ab:   { frets: [4, 6, 6, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    A:    { frets: [-1, 0, 2, 2, 2, 0] },
    "A#": { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bb:   { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    B:    { frets: [-1, 2, 4, 4, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // === Minor ===
    Cm:    { frets: [-1, 3, 5, 5, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    "C#m": { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbm:   { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dm:    { frets: [-1, -1, 0, 2, 3, 1] },
    "D#m": { frets: [-1, -1, 1, 3, 4, 2], baseFret: 1 },
    Ebm:   { frets: [-1, -1, 1, 3, 4, 2], baseFret: 1 },
    Em:    { frets: [0, 2, 2, 0, 0, 0] },
    Fm:    { frets: [1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#m": { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbm:   { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gm:    { frets: [3, 5, 5, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
    "G#m": { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abm:   { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Am:    { frets: [-1, 0, 2, 2, 1, 0] },
    "A#m": { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbm:   { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bm:    { frets: [-1, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // === Dominant 7th ===
    C7:    { frets: [-1, 3, 2, 3, 1, 0] },
    "C#7": { frets: [-1, 4, 3, 4, 2, -1], baseFret: 1 },
    Db7:   { frets: [-1, 4, 3, 4, 2, -1], baseFret: 1 },
    D7:    { frets: [-1, -1, 0, 2, 1, 2] },
    "D#7": { frets: [-1, -1, 1, 3, 2, 3], baseFret: 1 },
    Eb7:   { frets: [-1, -1, 1, 3, 2, 3], baseFret: 1 },
    E7:    { frets: [0, 2, 0, 1, 0, 0] },
    F7:    { frets: [1, 1, 2, 1, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#7": { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gb7:   { frets: [2, 4, 2, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    G7:    { frets: [3, 2, 0, 0, 0, 1] },
    "G#7": { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Ab7:   { frets: [4, 6, 4, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    A7:    { frets: [-1, 0, 2, 0, 2, 0] },
    "A#7": { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bb7:   { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    B7:    { frets: [-1, 2, 1, 2, 0, 2] },

    // === Minor 7th ===
    Cm7:    { frets: [-1, 3, 5, 3, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    "C#m7": { frets: [-1, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dm7:    { frets: [-1, -1, 0, 2, 1, 1] },
    "D#m7": { frets: [-1, -1, 1, 3, 2, 2], baseFret: 1 },
    Ebm7:   { frets: [-1, -1, 1, 3, 2, 2], baseFret: 1 },
    Em7:    { frets: [0, 2, 0, 0, 0, 0] },
    Fm7:    { frets: [1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#m7": { frets: [2, 4, 2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gm7:    { frets: [3, 5, 3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
    "G#m7": { frets: [4, 6, 4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abm7:   { frets: [4, 6, 4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Am7:    { frets: [-1, 0, 2, 0, 1, 0] },
    "A#m7": { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbm7:   { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bm7:    { frets: [-1, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // === Major 7th ===
    CM7:    { frets: [-1, 3, 2, 0, 0, 0] },
    Cmaj7:  { frets: [-1, 3, 2, 0, 0, 0] },
    DM7:    { frets: [-1, -1, 0, 2, 2, 2] },
    Dmaj7:  { frets: [-1, -1, 0, 2, 2, 2] },
    EM7:    { frets: [0, 2, 1, 1, 0, 0] },
    Emaj7:  { frets: [0, 2, 1, 1, 0, 0] },
    FM7:    { frets: [1, 1, 2, 2, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    Fmaj7:  { frets: [1, 1, 2, 2, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    GM7:    { frets: [3, 2, 0, 0, 0, 2] },
    Gmaj7:  { frets: [3, 2, 0, 0, 0, 2] },
    AM7:    { frets: [-1, 0, 2, 1, 2, 0] },
    Amaj7:  { frets: [-1, 0, 2, 1, 2, 0] },
    BM7:    { frets: [-1, 2, 4, 3, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
    Bmaj7:  { frets: [-1, 2, 4, 3, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
    "F#M7": { frets: [2, 4, 3, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "F#maj7": { frets: [2, 4, 3, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "BbM7": { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbmaj7: { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    "EbM7": { frets: [-1, -1, 1, 3, 3, 3], baseFret: 1 },
    Ebmaj7: { frets: [-1, -1, 1, 3, 3, 3], baseFret: 1 },
    "AbM7": { frets: [4, 6, 5, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abmaj7: { frets: [4, 6, 5, 5, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },

    // === Suspended ===
    Csus4: { frets: [-1, 3, 3, 0, 1, 1] },
    Dsus4: { frets: [-1, -1, 0, 2, 3, 3] },
    Dsus2: { frets: [-1, -1, 0, 2, 3, 0] },
    Esus4: { frets: [0, 2, 2, 2, 0, 0] },
    Gsus4: { frets: [3, 3, 0, 0, 1, 3] },
    Asus4: { frets: [-1, 0, 2, 2, 3, 0] },
    Asus2: { frets: [-1, 0, 2, 2, 0, 0] },
    Bsus4: { frets: [-1, 2, 4, 4, 5, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // === Diminished ===
    Cdim:  { frets: [-1, 3, 4, 2, 4, 2] },
    Ddim:  { frets: [-1, -1, 0, 1, 3, 1] },
    Edim:  { frets: [0, 1, 2, 0, -1, -1] },
    Fdim:  { frets: [1, 2, 3, 1, -1, -1] },
    Gdim:  { frets: [3, 4, 5, 3, -1, -1] },
    Adim:  { frets: [-1, 0, 1, 2, 1, -1] },
    Bdim:  { frets: [-1, 2, 3, 4, 3, -1] },
    "C#dim": { frets: [-1, 4, 5, 3, 5, 3], baseFret: 3 },
    "F#dim": { frets: [2, 3, 4, 2, -1, -1] },

    // === Augmented ===
    Caug:  { frets: [-1, 3, 2, 1, 1, 0] },
    Daug:  { frets: [-1, -1, 0, 3, 3, 2] },
    Eaug:  { frets: [0, 3, 2, 1, 1, 0] },
    Faug:  { frets: [1, 0, 3, 2, 2, 1] },
    Gaug:  { frets: [3, 2, 1, 0, 0, 3] },
    Aaug:  { frets: [-1, 0, 3, 2, 2, 1] },

    // === Add9 ===
    Cadd9: { frets: [-1, 3, 2, 0, 3, 0] },
    Dadd9: { frets: [-1, -1, 0, 2, 3, 0] },
    Eadd9: { frets: [0, 2, 2, 1, 0, 2] },
    Gadd9: { frets: [3, 0, 0, 0, 0, 3] },
    Aadd9: { frets: [-1, 0, 2, 2, 2, 2] },

    // === 9th ===
    C9:  { frets: [-1, 3, 2, 3, 3, 0] },
    D9:  { frets: [-1, -1, 0, 2, 1, 0] },
    E9:  { frets: [0, 2, 0, 1, 0, 2] },
    G9:  { frets: [3, 2, 0, 0, 0, 1] },
    A9:  { frets: [-1, 0, 2, 4, 2, 3] },

    // === 7sus4 ===
    A7sus4: { frets: [-1, 0, 2, 0, 3, 0] },
    D7sus4: { frets: [-1, -1, 0, 2, 1, 3] },
    E7sus4: { frets: [0, 2, 0, 2, 0, 0] },
    G7sus4: { frets: [3, 3, 0, 0, 1, 1] },

    // === m7b5 (half-diminished) ===
    "Bm7b5":  { frets: [-1, 2, 3, 2, 3, -1] },
    "Am7b5":  { frets: [-1, 0, 1, 2, 1, 3] },
    "C#m7b5": { frets: [-1, 4, 5, 4, 5, -1], baseFret: 4 },
    "F#m7b5": { frets: [2, 3, 2, 2, -1, -1] },
    "Gm7b5":  { frets: [3, 4, 3, 3, -1, -1] },
    "Em7b5":  { frets: [0, 1, 2, 0, 3, 0] },
    "Dm7b5":  { frets: [-1, -1, 0, 1, 1, 1] },

    // === dim7 ===
    "Cdim7":  { frets: [-1, 3, 4, 2, 4, 2] },
    "Ddim7":  { frets: [-1, -1, 0, 1, 0, 1] },
    "Edim7":  { frets: [0, 1, 2, 0, 2, 0] },
    "F#dim7": { frets: [2, 3, 4, 2, 4, 2] },
    "Gdim7":  { frets: [3, 4, 5, 3, 5, 3] },
    "Adim7":  { frets: [-1, 0, 1, 2, 1, 2] },
    "Bdim7":  { frets: [-1, 2, 3, 1, 3, 1] },
  },

  cavaquinho: {
    // === Major === (D-G-B-D tuning)
    C:    { frets: [0, 0, 0, 2] },
    "C#": { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    Db:   { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    D:    { frets: [0, 2, 3, 2] },
    "D#": { frets: [1, 3, 4, 3], baseFret: 1 },
    Eb:   { frets: [1, 3, 4, 3], baseFret: 1 },
    E:    { frets: [2, 1, 0, 2] },
    F:    { frets: [3, 2, 1, 0] },
    "F#": { frets: [4, 3, 2, 1] },
    Gb:   { frets: [4, 3, 2, 1] },
    G:    { frets: [0, 0, 0, 0] },
    "G#": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Ab:   { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    A:    { frets: [2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "A#": { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bb:   { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    B:    { frets: [4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },

    // === Minor ===
    Cm:    { frets: [0, 0, 0, 1] },
    "C#m": { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dm:    { frets: [0, 2, 3, 1] },
    "D#m": { frets: [1, 3, 4, 2], baseFret: 1 },
    Ebm:   { frets: [1, 3, 4, 2], baseFret: 1 },
    Em:    { frets: [2, 0, 0, 2] },
    Fm:    { frets: [3, 1, 1, 0], barres: [{ fret: 1, from: 1, to: 2 }] },
    "F#m": { frets: [4, 2, 2, 1], baseFret: 1 },
    Gm:    { frets: [0, 0, 0, 3] },
    "G#m": { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Abm:   { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Am:    { frets: [2, 2, 1, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "A#m": { frets: [3, 3, 2, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bbm:   { frets: [3, 3, 2, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bm:    { frets: [4, 4, 3, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },

    // === Dominant 7th ===
    C7:    { frets: [0, 0, 0, 0] },
    "C#7": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    D7:    { frets: [0, 2, 1, 2] },
    "D#7": { frets: [1, 3, 2, 3], baseFret: 1 },
    Eb7:   { frets: [1, 3, 2, 3], baseFret: 1 },
    E7:    { frets: [2, 1, 0, 0] },
    F7:    { frets: [3, 2, 1, 3] },
    "F#7": { frets: [4, 3, 2, 4], baseFret: 2 },
    Gb7:   { frets: [4, 3, 2, 4], baseFret: 2 },
    G7:    { frets: [0, 0, 0, 3] },
    "G#7": { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Ab7:   { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    A7:    { frets: [2, 2, 2, 0] },
    "A#7": { frets: [3, 3, 3, 1], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 1 },
    Bb7:   { frets: [3, 3, 3, 1], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 1 },
    B7:    { frets: [4, 4, 4, 2], baseFret: 2 },

    // === Minor 7th ===
    Cm7:    { frets: [0, 0, 0, 0] },
    Dm7:    { frets: [0, 2, 1, 1] },
    Em7:    { frets: [2, 0, 0, 0] },
    Fm7:    { frets: [3, 1, 1, 3], barres: [{ fret: 1, from: 1, to: 2 }] },
    Gm7:    { frets: [0, 0, 0, 1] },
    Am7:    { frets: [2, 2, 1, 0] },
    Bm7:    { frets: [4, 4, 3, 2], baseFret: 2 },
    "C#m7": { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    "F#m7": { frets: [4, 2, 2, 4], baseFret: 2 },
    "G#m7": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Abm7:   { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Bbm7:   { frets: [3, 3, 2, 1], baseFret: 1 },

    // === Major 7th ===
    CM7:    { frets: [0, 0, 0, 2] },
    Cmaj7:  { frets: [0, 0, 0, 2] },
    DM7:    { frets: [0, 2, 3, 2] },
    Dmaj7:  { frets: [0, 2, 3, 2] },
    GM7:    { frets: [0, 0, 0, 4] },
    Gmaj7:  { frets: [0, 0, 0, 4] },
    AM7:    { frets: [2, 2, 2, 1] },
    Amaj7:  { frets: [2, 2, 2, 1] },

    // === Suspended ===
    Dsus4: { frets: [0, 2, 3, 3] },
    Asus4: { frets: [2, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    Esus4: { frets: [2, 2, 0, 2], barres: [{ fret: 2, from: 0, to: 3 }] },

    // === Diminished ===
    Cdim:  { frets: [2, 0, 2, 1] },
    Ddim:  { frets: [0, 1, 3, 1] },
    Edim:  { frets: [2, 0, 2, 1] },
    Fdim:  { frets: [3, 1, 0, 3] },
    Gdim:  { frets: [0, 1, 0, 1] },

    // === Augmented ===
    Caug:  { frets: [0, 1, 0, 2] },
    Daug:  { frets: [0, 3, 3, 2] },
    Gaug:  { frets: [0, 1, 0, 0] },
  },

  ukulele: {
    C:    { frets: [0, 0, 0, 3] },
    D:    { frets: [2, 2, 2, 0] },
    E:    { frets: [1, 4, 0, 2] },
    F:    { frets: [2, 0, 1, 0] },
    G:    { frets: [0, 2, 3, 2] },
    A:    { frets: [2, 1, 0, 0] },
    B:    { frets: [4, 3, 2, 2] },
    Am:   { frets: [2, 0, 0, 0] },
    Dm:   { frets: [2, 2, 1, 0] },
    Em:   { frets: [0, 4, 3, 2] },
    Cm:   { frets: [0, 3, 3, 3] },
    Fm:   { frets: [1, 0, 1, 3] },
    Gm:   { frets: [0, 2, 3, 1] },
    Bm:   { frets: [4, 2, 2, 2] },
    C7:   { frets: [0, 0, 0, 1] },
    D7:   { frets: [2, 2, 2, 3] },
    E7:   { frets: [1, 2, 0, 2] },
    F7:   { frets: [2, 3, 1, 3] },
    G7:   { frets: [0, 2, 1, 2] },
    A7:   { frets: [0, 1, 0, 0] },
    B7:   { frets: [2, 3, 2, 2] },
    Am7:  { frets: [0, 0, 0, 0] },
    Dm7:  { frets: [2, 2, 1, 3] },
    Em7:  { frets: [0, 2, 0, 2] },
    Cm7:  { frets: [3, 3, 3, 3] },
    "Bb": { frets: [3, 2, 1, 1] },
    "F#": { frets: [3, 1, 2, 1] },
    "F#m": { frets: [2, 1, 2, 0] },
  },
};

function getStringsForInstrument(instrument: Instrument): number {
  if (instrument === "guitar") return 6;
  return 4;
}

/**
 * Assign finger numbers (1-4) to fretted positions based on fret layout.
 * Returns an array matching voicing.frets where each entry is the finger number (or 0 for open/-1 for muted).
 */
function assignFingers(frets: (number | -1)[], barres?: { fret: number; from: number; to: number }[]): number[] {
  // Collect fretted positions (fret > 0) that are NOT covered by a barre
  const barreFret = barres?.[0]?.fret ?? -1;
  const barreFrom = barres?.[0]?.from ?? -1;
  const barreTo = barres?.[0]?.to ?? -1;

  interface FretEntry { stringIdx: number; fret: number; isBarre: boolean }
  const entries: FretEntry[] = [];

  for (let s = 0; s < frets.length; s++) {
    const f = frets[s];
    if (f <= 0) continue;
    const isBarre = f === barreFret && s >= barreFrom && s <= barreTo;
    entries.push({ stringIdx: s, fret: f, isBarre });
  }

  const result = new Array(frets.length).fill(0);

  // Barre finger is always 1
  if (barres && barres.length > 0) {
    for (const e of entries) {
      if (e.isBarre) result[e.stringIdx] = 1;
    }
  }

  // Sort non-barre entries by fret then string position, assign fingers 2,3,4
  const nonBarre = entries.filter(e => !e.isBarre).sort((a, b) => a.fret - b.fret || a.stringIdx - b.stringIdx);
  let nextFinger = barres && barres.length > 0 ? 2 : 1;
  for (const e of nonBarre) {
    result[e.stringIdx] = Math.min(nextFinger, 4);
    nextFinger++;
  }

  return result;
}

/**
 * Draw a chord diagram on a canvas.
 * Accepts an optional pre-resolved voicing (from AI/cache) to bypass the local dictionary.
 */
export function drawChordDiagram(
  canvas: HTMLCanvasElement,
  chord: string,
  instrument: Instrument,
  preResolved?: { frets: (number | -1)[]; barres?: { fret: number; from: number; to: number }[]; baseFret?: number } | null,
  isSimplified?: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (instrument === "keyboard") {
    drawKeyboard(ctx, canvas, chord);
    return;
  }

  let voicing: ChordVoicing | null;
  let simplified: boolean;

  if (preResolved) {
    voicing = preResolved;
    simplified = isSimplified ?? false;
  } else {
    const resolved = resolveChordVoicing(chord, instrument);
    voicing = resolved.voicing;
    simplified = resolved.simplified;
  }
  const numStrings = getStringsForInstrument(instrument);
  const numFrets = 4;
  const w = canvas.width;
  const h = canvas.height;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const isFirstPosition = !voicing?.baseFret || voicing.baseFret <= 1;

  // Premium layout constants — no title area (rendered externally)
  const indicatorAreaH = Math.round(h * 0.12);   // top X/O area
  const titleAreaH = 0;                           // title drawn by parent component
  const nutH = isFirstPosition ? 4 : 0;
  const bottomPad = Math.round(h * 0.06);
  const sidePad = Math.round(w * 0.16);

  const gridTop = titleAreaH + indicatorAreaH + nutH;
  const gridH = h - gridTop - bottomPad;
  const gridW = w - sidePad * 2;
  const stringSpacing = gridW / (numStrings - 1);
  const fretSpacing = gridH / numFrets;
  const dotRadius = Math.min(stringSpacing, fretSpacing) * 0.3;

  // Theme colors
  const accentHSL = "hsl(217, 91%, 60%)";       // primary blue
  const accentFillHSL = "hsl(217, 91%, 60%, 0.18)";
  const gridColor = "hsl(220, 13%, 28%)";
  const gridColorLight = "hsl(220, 13%, 22%)";
  const textMuted = "hsl(220, 10%, 50%)";
  const textBright = "hsl(220, 15%, 85%)";
  const dotFill = accentHSL;
  const dotStroke = accentHSL;
  const fingerTextColor = "#fff";
  const barreColor = "hsl(217, 70%, 50%)";

  // Clear
  ctx.clearRect(0, 0, w, h);

  // ── Title ──
  ctx.fillStyle = textBright;
  ctx.font = `600 ${Math.round(w * 0.11)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const title = simplified ? `${chord} *` : chord;
  ctx.fillText(title, w / 2, titleAreaH * 0.5);

  // ── Top indicators: X (muted) and O (open) ──
  if (voicing) {
    const indY = titleAreaH + indicatorAreaH * 0.5;
    const indR = Math.max(3, dotRadius * 0.45);
    for (let s = 0; s < voicing.frets.length; s++) {
      const fret = voicing.frets[s];
      const x = sidePad + s * stringSpacing;
      if (fret === -1) {
        // X mark
        ctx.strokeStyle = textMuted;
        ctx.lineWidth = 1.2;
        const sz = indR * 0.8;
        ctx.beginPath();
        ctx.moveTo(x - sz, indY - sz);
        ctx.lineTo(x + sz, indY + sz);
        ctx.moveTo(x + sz, indY - sz);
        ctx.lineTo(x - sz, indY + sz);
        ctx.stroke();
      } else if (fret === 0) {
        // O mark
        ctx.strokeStyle = accentHSL;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, indY, indR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── Nut (thin elegant bar) ──
  if (isFirstPosition) {
    ctx.fillStyle = textBright;
    ctx.fillRect(sidePad - 0.5, gridTop - nutH, gridW + 1, nutH);
  }

  // ── Base fret indicator ──
  if (!isFirstPosition && voicing?.baseFret) {
    ctx.fillStyle = textMuted;
    ctx.font = `500 ${Math.round(fretSpacing * 0.32)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voicing.baseFret}fr`, sidePad - 5, gridTop + fretSpacing * 0.5);
  }

  // ── Grid: frets (thin horizontal lines) ──
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.7;
  for (let f = 0; f <= numFrets; f++) {
    const y = gridTop + f * fretSpacing;
    ctx.beginPath();
    ctx.moveTo(sidePad, y);
    ctx.lineTo(sidePad + gridW, y);
    ctx.stroke();
  }

  // ── Grid: strings (thin vertical lines) ──
  ctx.strokeStyle = gridColorLight;
  ctx.lineWidth = 0.6;
  for (let s = 0; s < numStrings; s++) {
    const x = sidePad + s * stringSpacing;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridTop + gridH);
    ctx.stroke();
  }

  if (!voicing) {
    ctx.fillStyle = textMuted;
    ctx.font = `400 ${Math.round(w * 0.07)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Indisponível", w / 2, gridTop + gridH / 2);
    return;
  }

  const fingers = assignFingers(voicing.frets, voicing.barres);

  // ── Barres (rounded, semi-transparent) ──
  if (voicing.barres) {
    for (const barre of voicing.barres) {
      const relativeFret = voicing.baseFret && voicing.baseFret > 1
        ? barre.fret - voicing.baseFret + 1
        : barre.fret;
      const y = gridTop + (relativeFret - 0.5) * fretSpacing;
      const x1 = sidePad + barre.from * stringSpacing;
      const x2 = sidePad + barre.to * stringSpacing;
      const barreR = dotRadius * 0.85;

      ctx.fillStyle = barreColor;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x1, y - barreR);
      ctx.lineTo(x2, y - barreR);
      ctx.arc(x2, y, barreR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x1, y + barreR);
      ctx.arc(x1, y, barreR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Finger "1" label
      ctx.fillStyle = fingerTextColor;
      ctx.font = `600 ${Math.round(barreR * 1.2)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("1", x1, y + 0.5);
    }
  }

  // ── Fret dots (colored rings with subtle fill) ──
  for (let s = 0; s < voicing.frets.length; s++) {
    const fret = voicing.frets[s];
    const x = sidePad + s * stringSpacing;

    if (fret > 0) {
      const isCoveredByBarre = voicing.barres?.some(
        b => fret === b.fret && s >= b.from && s <= b.to
      );
      if (isCoveredByBarre) continue;

      const relativeFret = voicing.baseFret && voicing.baseFret > 1
        ? fret - voicing.baseFret + 1
        : fret;
      const y = gridTop + (relativeFret - 0.5) * fretSpacing;

      // Subtle fill
      ctx.fillStyle = accentFillHSL;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ring border
      ctx.strokeStyle = dotStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Finger number
      if (fingers[s] > 0) {
        ctx.fillStyle = accentHSL;
        ctx.font = `600 ${Math.round(dotRadius * 1.1)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(fingers[s]), x, y + 0.5);
      }
    }
  }

  // ── Simplified indicator ──
  if (simplified) {
    ctx.fillStyle = textMuted;
    ctx.font = `400 ${Math.round(w * 0.055)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("* simplificado", w / 2, h - 1);
  }
}

function drawKeyboard(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, chord: string) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "hsl(220, 15%, 90%)";
  ctx.font = "bold 18px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(chord, w / 2, 24);

  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys = [1, 3, 6, 8, 10];

  const chordNotes = getChordNotes(chord, NOTES);

  const keyW = 32;
  const keyH = 120;
  const blackKeyW = 20;
  const blackKeyH = 75;
  const startX = (w - 7 * keyW) / 2;
  const startY = 40;

  for (let i = 0; i < 7; i++) {
    const x = startX + i * keyW;
    const noteIdx = whiteKeys[i];
    const isActive = chordNotes.includes(noteIdx);

    ctx.fillStyle = isActive ? "hsl(36, 95%, 55%)" : "hsl(220, 15%, 85%)";
    ctx.fillRect(x, startY, keyW - 2, keyH);
    ctx.strokeStyle = "hsl(220, 15%, 30%)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, startY, keyW - 2, keyH);

    if (isActive) {
      ctx.fillStyle = "hsl(220, 20%, 7%)";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(NOTES[noteIdx], x + (keyW - 2) / 2, startY + keyH - 8);
    }
  }

  const blackKeyPositions = [0, 1, 3, 4, 5];
  for (let i = 0; i < blackKeys.length; i++) {
    const whiteIdx = blackKeyPositions[i];
    const x = startX + whiteIdx * keyW + keyW - blackKeyW / 2 - 1;
    const noteIdx = blackKeys[i];
    const isActive = chordNotes.includes(noteIdx);

    ctx.fillStyle = isActive ? "hsl(36, 70%, 45%)" : "hsl(220, 20%, 12%)";
    ctx.fillRect(x, startY, blackKeyW, blackKeyH);
    ctx.strokeStyle = "hsl(220, 15%, 25%)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, startY, blackKeyW, blackKeyH);
  }
}

function getChordNotes(chord: string, NOTES: string[]): number[] {
  const match = chord.match(/^([A-G][#b]?)(m|maj|min|dim|aug|sus|add)?([0-9]?)$/);
  if (!match) return [];

  const root = match[1];
  const quality = match[2] || "";
  let rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) {
    const flatMap: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
    rootIdx = NOTES.indexOf(flatMap[root] || root);
  }
  if (rootIdx === -1) return [];

  let intervals = [0, 4, 7];
  if (quality === "m" || quality === "min") intervals = [0, 3, 7];
  else if (quality === "dim") intervals = [0, 3, 6];
  else if (quality === "aug") intervals = [0, 4, 8];
  else if (quality === "sus") intervals = [0, 5, 7];

  return intervals.map((i) => (rootIdx + i) % 12);
}
