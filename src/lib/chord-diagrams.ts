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
 * Resolve ALL available voicings for a chord on a given instrument.
 * Returns an array of voicings (the first is always the "default" from CHORD_DB).
 */
export function resolveAllVoicings(
  chord: string,
  instrument: Instrument
): ChordVoicing[] {
  if (instrument === "keyboard") return [];

  const db = CHORD_DB[instrument];
  const altDb = CHORD_ALT_VOICINGS[instrument];
  if (!db) return [];

  // Find the resolved key in the DB
  const lookupChain = getChordLookupChain(chord);
  let resolvedKey: string | null = null;

  for (const { name } of lookupChain) {
    if (db[name]) { resolvedKey = name; break; }
    const rootMatch = name.match(/^([A-G][#b]?)(.*)/);
    if (rootMatch) {
      const alt = ENHARMONIC[rootMatch[1]];
      if (alt && db[alt + rootMatch[2]]) { resolvedKey = alt + rootMatch[2]; break; }
    }
  }

  if (!resolvedKey) {
    const normalized = normalizeChordName(chord);
    const simplifications = buildSimplifications(normalized);
    for (const simpl of simplifications) {
      if (db[simpl]) { resolvedKey = simpl; break; }
      const sMatch = simpl.match(/^([A-G][#b]?)(.*)/);
      if (sMatch) {
        const alt = ENHARMONIC[sMatch[1]];
        if (alt && db[alt + sMatch[2]]) { resolvedKey = alt + sMatch[2]; break; }
      }
    }
  }

  if (!resolvedKey) return [];

  const primary = db[resolvedKey];
  const alternatives = altDb?.[resolvedKey] || [];
  return [primary, ...alternatives];
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
    // ═══════════════════════════════════════════════════════════════
    // GUITAR — 6 strings (E A D G B e), low to high, index 0–5
    // frets: [-1=muted, 0=open, N=fret number]
    // ═══════════════════════════════════════════════════════════════

    // ── Major ─────────────────────────────────────────────────────
    C:    { frets: [-1, 3, 2, 0, 1, 0] },
    "C#": { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Db:   { frets: [-1, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    D:    { frets: [-1, -1, 0, 2, 3, 2] },
    "D#": { frets: [-1, 6, 8, 8, 8, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Eb:   { frets: [-1, 6, 8, 8, 8, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    E:    { frets: [0, 2, 2, 1, 0, 0] },
    F:    { frets: [1, 1, 2, 3, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#": { frets: [2, 2, 4, 4, 4, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gb:   { frets: [2, 2, 4, 4, 4, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    G:    { frets: [3, 2, 0, 0, 0, 3] },
    "G#": { frets: [4, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Ab:   { frets: [4, 4, 6, 6, 6, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    A:    { frets: [-1, 0, 2, 2, 2, 0] },
    "A#": { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bb:   { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    B:    { frets: [-1, 2, 4, 4, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Minor ─────────────────────────────────────────────────────
    Cm:    { frets: [-1, 3, 5, 5, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    "C#m": { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbm:   { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dm:    { frets: [-1, -1, 0, 2, 3, 1] },
    "D#m": { frets: [-1, 6, 8, 8, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebm:   { frets: [-1, 6, 8, 8, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Em:    { frets: [0, 2, 2, 0, 0, 0] },
    Fm:    { frets: [1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#m": { frets: [2, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbm:   { frets: [2, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gm:    { frets: [3, 5, 5, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
    "G#m": { frets: [4, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abm:   { frets: [4, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Am:    { frets: [-1, 0, 2, 2, 1, 0] },
    "A#m": { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbm:   { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bm:    { frets: [-1, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Dominant 7th ──────────────────────────────────────────────
    C7:    { frets: [-1, 3, 2, 3, 1, 0] },
    "C#7": { frets: [-1, 4, 3, 4, 2, 4], baseFret: 4 },
    Db7:   { frets: [-1, 4, 3, 4, 2, 4], baseFret: 4 },
    D7:    { frets: [-1, -1, 0, 2, 1, 2] },
    "D#7": { frets: [-1, 6, 5, 6, 4, 6], baseFret: 4 },
    Eb7:   { frets: [-1, 6, 5, 6, 4, 6], baseFret: 4 },
    E7:    { frets: [0, 2, 0, 1, 0, 0] },
    F7:    { frets: [1, 1, 2, 1, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#7": { frets: [2, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gb7:   { frets: [2, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    G7:    { frets: [3, 2, 0, 0, 0, 1] },
    "G#7": { frets: [4, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Ab7:   { frets: [4, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    A7:    { frets: [-1, 0, 2, 0, 2, 0] },
    "A#7": { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bb7:   { frets: [-1, 1, 3, 1, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    B7:    { frets: [-1, 2, 1, 2, 0, 2] },

    // ── Minor 7th ─────────────────────────────────────────────────
    Cm7:    { frets: [-1, 3, 5, 3, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    "C#m7": { frets: [-1, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbm7:   { frets: [-1, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dm7:    { frets: [-1, -1, 0, 2, 1, 1] },
    "D#m7": { frets: [-1, 6, 8, 6, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebm7:   { frets: [-1, 6, 8, 6, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Em7:    { frets: [0, 2, 0, 0, 0, 0] },
    Fm7:    { frets: [1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#m7": { frets: [2, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbm7:   { frets: [2, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gm7:    { frets: [3, 5, 3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
    "G#m7": { frets: [4, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abm7:   { frets: [4, 4, 6, 4, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Am7:    { frets: [-1, 0, 2, 0, 1, 0] },
    "A#m7": { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbm7:   { frets: [-1, 1, 3, 1, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bm7:    { frets: [-1, 2, 4, 2, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Major 7th (maj7 / M7 / 7M) ───────────────────────────────
    CM7:      { frets: [-1, 3, 2, 0, 0, 0] },
    Cmaj7:    { frets: [-1, 3, 2, 0, 0, 0] },
    "C#M7":   { frets: [-1, 4, 6, 5, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    "C#maj7": { frets: [-1, 4, 6, 5, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    DbM7:     { frets: [-1, 4, 6, 5, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbmaj7:   { frets: [-1, 4, 6, 5, 6, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    DM7:      { frets: [-1, -1, 0, 2, 2, 2] },
    Dmaj7:    { frets: [-1, -1, 0, 2, 2, 2] },
    "D#M7":   { frets: [-1, 6, 8, 7, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    "D#maj7": { frets: [-1, 6, 8, 7, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    EbM7:     { frets: [-1, 6, 8, 7, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebmaj7:   { frets: [-1, 6, 8, 7, 7, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    EM7:      { frets: [0, 2, 1, 1, 0, 0] },
    Emaj7:    { frets: [0, 2, 1, 1, 0, 0] },
    FM7:      { frets: [1, 1, 2, 2, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    Fmaj7:    { frets: [1, 1, 2, 2, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#M7":   { frets: [2, 2, 4, 3, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "F#maj7": { frets: [2, 2, 4, 3, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    GbM7:     { frets: [2, 2, 4, 3, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbmaj7:   { frets: [2, 2, 4, 3, 3, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    GM7:      { frets: [3, 2, 0, 0, 0, 2] },
    Gmaj7:    { frets: [3, 2, 0, 0, 0, 2] },
    "G#M7":   { frets: [4, 4, 6, 5, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    "G#maj7": { frets: [4, 4, 6, 5, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    AbM7:     { frets: [4, 4, 6, 5, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abmaj7:   { frets: [4, 4, 6, 5, 5, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    AM7:      { frets: [-1, 0, 2, 1, 2, 0] },
    Amaj7:    { frets: [-1, 0, 2, 1, 2, 0] },
    "A#M7":   { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    "A#maj7": { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    BbM7:     { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbmaj7:   { frets: [-1, 1, 3, 2, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    BM7:      { frets: [-1, 2, 4, 3, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
    Bmaj7:    { frets: [-1, 2, 4, 3, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Suspended 4 ───────────────────────────────────────────────
    Csus4:    { frets: [-1, 3, 3, 0, 1, 1] },
    "C#sus4": { frets: [-1, 4, 6, 6, 7, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbsus4:   { frets: [-1, 4, 6, 6, 7, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dsus4:    { frets: [-1, -1, 0, 2, 3, 3] },
    "D#sus4": { frets: [-1, 6, 8, 8, 9, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebsus4:   { frets: [-1, 6, 8, 8, 9, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Esus4:    { frets: [0, 2, 2, 2, 0, 0] },
    Fsus4:    { frets: [1, 1, 3, 3, 4, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#sus4": { frets: [2, 2, 4, 4, 5, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbsus4:   { frets: [2, 2, 4, 4, 5, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gsus4:    { frets: [3, 3, 0, 0, 1, 3] },
    "G#sus4": { frets: [4, 4, 6, 6, 7, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Absus4:   { frets: [4, 4, 6, 6, 7, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Asus4:    { frets: [-1, 0, 2, 2, 3, 0] },
    "A#sus4": { frets: [-1, 1, 3, 3, 4, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbsus4:   { frets: [-1, 1, 3, 3, 4, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bsus4:    { frets: [-1, 2, 4, 4, 5, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Suspended 2 ───────────────────────────────────────────────
    Csus2:    { frets: [-1, 3, 3, 0, 3, 1] },
    "C#sus2": { frets: [-1, 4, 6, 6, 4, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbsus2:   { frets: [-1, 4, 6, 6, 4, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dsus2:    { frets: [-1, -1, 0, 2, 3, 0] },
    "D#sus2": { frets: [-1, 6, 8, 8, 6, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebsus2:   { frets: [-1, 6, 8, 8, 6, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Esus2:    { frets: [0, 2, 4, 4, 0, 0] },
    Fsus2:    { frets: [1, 1, 3, 3, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#sus2": { frets: [2, 2, 4, 4, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbsus2:   { frets: [2, 2, 4, 4, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gsus2:    { frets: [3, 0, 0, 0, 1, 3] },
    "G#sus2": { frets: [4, 4, 6, 6, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Absus2:   { frets: [4, 4, 6, 6, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Asus2:    { frets: [-1, 0, 2, 2, 0, 0] },
    "A#sus2": { frets: [-1, 1, 3, 3, 1, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbsus2:   { frets: [-1, 1, 3, 3, 1, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bsus2:    { frets: [-1, 2, 4, 4, 2, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Diminished ────────────────────────────────────────────────
    Cdim:     { frets: [-1, 3, 4, 5, 4, -1] },
    "C#dim":  { frets: [-1, 4, 5, 6, 5, -1], baseFret: 4 },
    Dbdim:    { frets: [-1, 4, 5, 6, 5, -1], baseFret: 4 },
    Ddim:     { frets: [-1, -1, 0, 1, 3, 1] },
    "D#dim":  { frets: [-1, -1, 1, 2, 4, 2] },
    Ebdim:    { frets: [-1, -1, 1, 2, 4, 2] },
    Edim:     { frets: [0, 1, 2, 0, -1, -1] },
    Fdim:     { frets: [1, 2, 3, 1, -1, -1] },
    "F#dim":  { frets: [2, 3, 4, 2, -1, -1] },
    Gbdim:    { frets: [2, 3, 4, 2, -1, -1] },
    Gdim:     { frets: [3, 4, 5, 3, -1, -1] },
    "G#dim":  { frets: [4, 5, 6, 4, -1, -1], baseFret: 4 },
    Abdim:    { frets: [4, 5, 6, 4, -1, -1], baseFret: 4 },
    Adim:     { frets: [-1, 0, 1, 2, 1, -1] },
    "A#dim":  { frets: [-1, 1, 2, 3, 2, -1] },
    Bbdim:    { frets: [-1, 1, 2, 3, 2, -1] },
    Bdim:     { frets: [-1, 2, 3, 4, 3, -1] },

    // ── Half-Diminished / m7b5 ────────────────────────────────────
    Cm7b5:    { frets: [-1, 3, 4, 3, 4, -1] },
    "C#m7b5": { frets: [-1, 4, 5, 4, 5, -1], baseFret: 4 },
    Dbm7b5:   { frets: [-1, 4, 5, 4, 5, -1], baseFret: 4 },
    Dm7b5:    { frets: [-1, -1, 0, 1, 1, 1] },
    "D#m7b5": { frets: [-1, 6, 7, 6, 7, -1], baseFret: 6 },
    Ebm7b5:   { frets: [-1, 6, 7, 6, 7, -1], baseFret: 6 },
    Em7b5:    { frets: [0, 1, 2, 0, 3, 0] },
    Fm7b5:    { frets: [1, 2, 3, 1, 4, 1] },
    "F#m7b5": { frets: [2, 3, 2, 2, -1, -1] },
    Gbm7b5:   { frets: [2, 3, 2, 2, -1, -1] },
    Gm7b5:    { frets: [3, 4, 3, 3, -1, -1] },
    "G#m7b5": { frets: [4, 5, 4, 4, -1, -1], baseFret: 4 },
    Abm7b5:   { frets: [4, 5, 4, 4, -1, -1], baseFret: 4 },
    Am7b5:    { frets: [-1, 0, 1, 2, 1, 3] },
    "A#m7b5": { frets: [-1, 1, 2, 3, 2, 4] },
    Bbm7b5:   { frets: [-1, 1, 2, 3, 2, 4] },
    Bm7b5:    { frets: [-1, 2, 3, 2, 3, -1] },

    // ── Add9 ──────────────────────────────────────────────────────
    Cadd9:    { frets: [-1, 3, 2, 0, 3, 0] },
    "C#add9": { frets: [-1, 4, 6, 6, 9, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dbadd9:   { frets: [-1, 4, 6, 6, 9, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    Dadd9:    { frets: [-1, -1, 0, 2, 3, 0] },
    "D#add9": { frets: [-1, 6, 8, 8, 11, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Ebadd9:   { frets: [-1, 6, 8, 8, 11, 6], barres: [{ fret: 6, from: 1, to: 5 }], baseFret: 6 },
    Eadd9:    { frets: [0, 2, 2, 1, 0, 2] },
    Fadd9:    { frets: [1, 1, 2, 3, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    "F#add9": { frets: [2, 2, 4, 3, 2, 4], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gbadd9:   { frets: [2, 2, 4, 3, 2, 4], barres: [{ fret: 2, from: 0, to: 5 }] },
    Gadd9:    { frets: [3, 0, 0, 0, 0, 3] },
    "G#add9": { frets: [4, 4, 6, 5, 4, 6], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Abadd9:   { frets: [4, 4, 6, 5, 4, 6], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    Aadd9:    { frets: [-1, 0, 2, 2, 2, 2] },
    "A#add9": { frets: [-1, 1, 3, 3, 1, 3], barres: [{ fret: 1, from: 1, to: 5 }] },
    Bbadd9:   { frets: [-1, 1, 3, 3, 1, 3], barres: [{ fret: 1, from: 1, to: 5 }] },
    Badd9:    { frets: [-1, 2, 4, 4, 2, 4], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── Augmented ─────────────────────────────────────────────────
    Caug:     { frets: [-1, 3, 2, 1, 1, 0] },
    "C#aug":  { frets: [-1, 4, 3, 2, 2, 1] },
    Dbaug:    { frets: [-1, 4, 3, 2, 2, 1] },
    Daug:     { frets: [-1, -1, 0, 3, 3, 2] },
    "D#aug":  { frets: [-1, -1, 1, 4, 4, 3] },
    Ebaug:    { frets: [-1, -1, 1, 4, 4, 3] },
    Eaug:     { frets: [0, 3, 2, 1, 1, 0] },
    Faug:     { frets: [1, 0, 3, 2, 2, 1] },
    "F#aug":  { frets: [2, 1, 0, 3, 3, 2] },
    Gbaug:    { frets: [2, 1, 0, 3, 3, 2] },
    Gaug:     { frets: [3, 2, 1, 0, 0, 3] },
    "G#aug":  { frets: [4, 3, 2, 1, 1, 4] },
    Abaug:    { frets: [4, 3, 2, 1, 1, 4] },
    Aaug:     { frets: [-1, 0, 3, 2, 2, 1] },
    "A#aug":  { frets: [-1, 1, 4, 3, 3, 2] },
    Bbaug:    { frets: [-1, 1, 4, 3, 3, 2] },
    Baug:     { frets: [-1, 2, 1, 0, 0, 3] },

    // ── Dominant 9th ──────────────────────────────────────────────
    C9:  { frets: [-1, 3, 2, 3, 3, 0] },
    D9:  { frets: [-1, -1, 0, 2, 1, 0] },
    E9:  { frets: [0, 2, 0, 1, 0, 2] },
    F9:  { frets: [1, 1, 2, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 5 }] },
    G9:  { frets: [3, 2, 0, 0, 0, 1] },
    A9:  { frets: [-1, 0, 2, 4, 2, 3] },
    B9:  { frets: [-1, 2, 1, 2, 2, 4] },

    // ── 7sus4 ─────────────────────────────────────────────────────
    C7sus4:   { frets: [-1, 3, 3, 3, 1, 1] },
    "C#7sus4":{ frets: [-1, 4, 6, 4, 7, 4], baseFret: 4 },
    D7sus4:   { frets: [-1, -1, 0, 2, 1, 3] },
    E7sus4:   { frets: [0, 2, 0, 2, 0, 0] },
    F7sus4:   { frets: [1, 1, 3, 1, 4, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    G7sus4:   { frets: [3, 3, 0, 0, 1, 1] },
    A7sus4:   { frets: [-1, 0, 2, 0, 3, 0] },
    B7sus4:   { frets: [-1, 2, 4, 2, 5, 2], barres: [{ fret: 2, from: 1, to: 5 }] },

    // ── dim7 ──────────────────────────────────────────────────────
    Cdim7:    { frets: [-1, 3, 4, 2, 4, 2] },
    "C#dim7": { frets: [-1, 4, 5, 3, 5, 3], baseFret: 3 },
    Dbdim7:   { frets: [-1, 4, 5, 3, 5, 3], baseFret: 3 },
    Ddim7:    { frets: [-1, -1, 0, 1, 0, 1] },
    "D#dim7": { frets: [-1, -1, 1, 2, 1, 2] },
    Ebdim7:   { frets: [-1, -1, 1, 2, 1, 2] },
    Edim7:    { frets: [0, 1, 2, 0, 2, 0] },
    Fdim7:    { frets: [1, 2, 3, 1, 3, 1] },
    "F#dim7": { frets: [2, 3, 4, 2, 4, 2] },
    Gbdim7:   { frets: [2, 3, 4, 2, 4, 2] },
    Gdim7:    { frets: [3, 4, 5, 3, 5, 3] },
    "G#dim7": { frets: [4, 5, 6, 4, 6, 4], baseFret: 4 },
    Abdim7:   { frets: [4, 5, 6, 4, 6, 4], baseFret: 4 },
    Adim7:    { frets: [-1, 0, 1, 2, 1, 2] },
    "A#dim7": { frets: [-1, 1, 2, 3, 2, 3] },
    Bbdim7:   { frets: [-1, 1, 2, 3, 2, 3] },
    Bdim7:    { frets: [-1, 2, 3, 1, 3, 1] },
  },

  cavaquinho: {
    // ═══════════════════════════════════════════════════════════════
    // CAVAQUINHO — 4 strings (D-G-B-D tuning), index 0–3
    // ═══════════════════════════════════════════════════════════════

    // ── Major ─────────────────────────────────────────────────────
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

    // ── Minor ─────────────────────────────────────────────────────
    Cm:    { frets: [0, 0, 0, 1] },
    "C#m": { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dbm:   { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dm:    { frets: [0, 2, 3, 1] },
    "D#m": { frets: [1, 3, 4, 2], baseFret: 1 },
    Ebm:   { frets: [1, 3, 4, 2], baseFret: 1 },
    Em:    { frets: [2, 0, 0, 2] },
    Fm:    { frets: [3, 1, 1, 0], barres: [{ fret: 1, from: 1, to: 2 }] },
    "F#m": { frets: [4, 2, 2, 1], baseFret: 1 },
    Gbm:   { frets: [4, 2, 2, 1], baseFret: 1 },
    Gm:    { frets: [0, 0, 0, 3] },
    "G#m": { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Abm:   { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Am:    { frets: [2, 2, 1, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "A#m": { frets: [3, 3, 2, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bbm:   { frets: [3, 3, 2, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bm:    { frets: [4, 4, 3, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },

    // ── Dominant 7th ──────────────────────────────────────────────
    C7:    { frets: [0, 0, 0, 0] },
    "C#7": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Db7:   { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
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
    "A#7": { frets: [3, 3, 3, 1], baseFret: 1 },
    Bb7:   { frets: [3, 3, 3, 1], baseFret: 1 },
    B7:    { frets: [4, 4, 4, 2], baseFret: 2 },

    // ── Minor 7th ─────────────────────────────────────────────────
    Cm7:    { frets: [3, 3, 3, 4], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 3 },
    "C#m7": { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dbm7:   { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dm7:    { frets: [0, 2, 1, 1] },
    "D#m7": { frets: [1, 3, 2, 2], baseFret: 1 },
    Ebm7:   { frets: [1, 3, 2, 2], baseFret: 1 },
    Em7:    { frets: [2, 0, 0, 0] },
    Fm7:    { frets: [3, 1, 1, 3], barres: [{ fret: 1, from: 1, to: 2 }] },
    "F#m7": { frets: [4, 2, 2, 4], baseFret: 2 },
    Gbm7:   { frets: [4, 2, 2, 4], baseFret: 2 },
    Gm7:    { frets: [0, 0, 0, 1] },
    "G#m7": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Abm7:   { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Am7:    { frets: [2, 2, 1, 0] },
    "A#m7": { frets: [3, 3, 2, 1], baseFret: 1 },
    Bbm7:   { frets: [3, 3, 2, 1], baseFret: 1 },
    Bm7:    { frets: [4, 4, 3, 2], baseFret: 2 },

    // ── Major 7th ─────────────────────────────────────────────────
    CM7:    { frets: [0, 0, 0, 2] },
    Cmaj7:  { frets: [0, 0, 0, 2] },
    "C#M7": { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    "C#maj7":{ frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    DbM7:   { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    Dbmaj7: { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    DM7:    { frets: [0, 2, 3, 2] },
    Dmaj7:  { frets: [0, 2, 3, 2] },
    "D#M7": { frets: [1, 3, 4, 3], baseFret: 1 },
    "D#maj7":{ frets: [1, 3, 4, 3], baseFret: 1 },
    EbM7:   { frets: [1, 3, 4, 3], baseFret: 1 },
    Ebmaj7: { frets: [1, 3, 4, 3], baseFret: 1 },
    EM7:    { frets: [2, 1, 0, 1] },
    Emaj7:  { frets: [2, 1, 0, 1] },
    FM7:    { frets: [3, 2, 1, 1] },
    Fmaj7:  { frets: [3, 2, 1, 1] },
    "F#M7": { frets: [4, 3, 2, 2] },
    "F#maj7":{ frets: [4, 3, 2, 2] },
    GbM7:   { frets: [4, 3, 2, 2] },
    Gbmaj7: { frets: [4, 3, 2, 2] },
    GM7:    { frets: [0, 0, 0, 4] },
    Gmaj7:  { frets: [0, 0, 0, 4] },
    "G#M7": { frets: [1, 1, 1, 5], barres: [{ fret: 1, from: 0, to: 2 }] },
    "G#maj7":{ frets: [1, 1, 1, 5], barres: [{ fret: 1, from: 0, to: 2 }] },
    AbM7:   { frets: [1, 1, 1, 5], barres: [{ fret: 1, from: 0, to: 2 }] },
    Abmaj7: { frets: [1, 1, 1, 5], barres: [{ fret: 1, from: 0, to: 2 }] },
    AM7:    { frets: [2, 2, 2, 1] },
    Amaj7:  { frets: [2, 2, 2, 1] },
    "A#M7": { frets: [3, 3, 3, 2], baseFret: 2 },
    "A#maj7":{ frets: [3, 3, 3, 2], baseFret: 2 },
    BbM7:   { frets: [3, 3, 3, 2], baseFret: 2 },
    Bbmaj7: { frets: [3, 3, 3, 2], baseFret: 2 },
    BM7:    { frets: [4, 4, 4, 3], baseFret: 3 },
    Bmaj7:  { frets: [4, 4, 4, 3], baseFret: 3 },

    // ── Suspended 4 ───────────────────────────────────────────────
    Csus4:    { frets: [0, 0, 1, 2] },
    "C#sus4": { frets: [1, 1, 2, 3], barres: [{ fret: 1, from: 0, to: 1 }] },
    Dbsus4:   { frets: [1, 1, 2, 3], barres: [{ fret: 1, from: 0, to: 1 }] },
    Dsus4:    { frets: [0, 2, 3, 3] },
    "D#sus4": { frets: [1, 3, 4, 4], baseFret: 1 },
    Ebsus4:   { frets: [1, 3, 4, 4], baseFret: 1 },
    Esus4:    { frets: [2, 2, 0, 2], barres: [{ fret: 2, from: 0, to: 1 }] },
    Fsus4:    { frets: [3, 3, 1, 0] },
    "F#sus4": { frets: [4, 4, 2, 1] },
    Gbsus4:   { frets: [4, 4, 2, 1] },
    Gsus4:    { frets: [0, 0, 1, 0] },
    "G#sus4": { frets: [1, 1, 2, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Absus4:   { frets: [1, 1, 2, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Asus4:    { frets: [2, 2, 3, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "A#sus4": { frets: [3, 3, 4, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bbsus4:   { frets: [3, 3, 4, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bsus4:    { frets: [4, 4, 5, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },

    // ── Suspended 2 ───────────────────────────────────────────────
    Csus2:    { frets: [0, 0, 0, 0] },
    "C#sus2": { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Dbsus2:   { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Dsus2:    { frets: [0, 2, 3, 0] },
    "D#sus2": { frets: [1, 3, 4, 1] },
    Ebsus2:   { frets: [1, 3, 4, 1] },
    Esus2:    { frets: [2, 1, 0, 0] },
    Fsus2:    { frets: [0, 2, 1, 0] },
    "F#sus2": { frets: [4, 3, 2, 0] },
    Gbsus2:   { frets: [4, 3, 2, 0] },
    Gsus2:    { frets: [0, 0, 0, 2] },
    "G#sus2": { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    Absus2:   { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    Asus2:    { frets: [2, 2, 2, 4], barres: [{ fret: 2, from: 0, to: 2 }] },
    "A#sus2": { frets: [3, 3, 3, 5], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 3 },
    Bbsus2:   { frets: [3, 3, 3, 5], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 3 },
    Bsus2:    { frets: [4, 4, 4, 6], barres: [{ fret: 4, from: 0, to: 2 }], baseFret: 4 },

    // ── Diminished ────────────────────────────────────────────────
    Cdim:     { frets: [2, 0, 2, 1] },
    "C#dim":  { frets: [3, 1, 3, 2] },
    Dbdim:    { frets: [3, 1, 3, 2] },
    Ddim:     { frets: [0, 1, 3, 1] },
    "D#dim":  { frets: [1, 2, 4, 2] },
    Ebdim:    { frets: [1, 2, 4, 2] },
    Edim:     { frets: [2, 0, 2, 1] },
    Fdim:     { frets: [3, 1, 0, 3] },
    "F#dim":  { frets: [0, 2, 1, 0] },
    Gbdim:    { frets: [0, 2, 1, 0] },
    Gdim:     { frets: [0, 1, 0, 1] },
    "G#dim":  { frets: [1, 2, 1, 2] },
    Abdim:    { frets: [1, 2, 1, 2] },
    Adim:     { frets: [2, 3, 2, 3] },
    "A#dim":  { frets: [3, 4, 3, 4] },
    Bbdim:    { frets: [3, 4, 3, 4] },
    Bdim:     { frets: [0, 1, 0, 4] },

    // ── m7b5 ──────────────────────────────────────────────────────
    Cm7b5:    { frets: [2, 3, 3, 4] },
    "C#m7b5": { frets: [3, 4, 4, 5], baseFret: 2 },
    Dbm7b5:   { frets: [3, 4, 4, 5], baseFret: 2 },
    Dm7b5:    { frets: [0, 1, 1, 1] },
    "D#m7b5": { frets: [1, 2, 2, 2] },
    Ebm7b5:   { frets: [1, 2, 2, 2] },
    Em7b5:    { frets: [2, 0, 0, 0] },
    Fm7b5:    { frets: [3, 1, 1, 3] },
    "F#m7b5": { frets: [0, 2, 2, 1] },
    Gbm7b5:   { frets: [0, 2, 2, 1] },
    Gm7b5:    { frets: [0, 3, 3, 4] },
    "G#m7b5": { frets: [1, 4, 4, 5] },
    Abm7b5:   { frets: [1, 4, 4, 5] },
    Am7b5:    { frets: [2, 2, 1, 3] },
    "A#m7b5": { frets: [3, 3, 2, 4] },
    Bbm7b5:   { frets: [3, 3, 2, 4] },
    Bm7b5:    { frets: [4, 4, 3, 5], baseFret: 3 },

    // ── Add9 ──────────────────────────────────────────────────────
    Cadd9:    { frets: [0, 0, 0, 4] },
    "C#add9": { frets: [1, 1, 1, 5] },
    Dbadd9:   { frets: [1, 1, 1, 5] },
    Dadd9:    { frets: [0, 2, 3, 4] },
    "D#add9": { frets: [1, 3, 4, 5], baseFret: 1 },
    Ebadd9:   { frets: [1, 3, 4, 5], baseFret: 1 },
    Eadd9:    { frets: [2, 1, 2, 2] },
    Fadd9:    { frets: [3, 2, 3, 0] },
    "F#add9": { frets: [4, 3, 4, 1] },
    Gbadd9:   { frets: [4, 3, 4, 1] },
    Gadd9:    { frets: [0, 0, 2, 0] },
    "G#add9": { frets: [1, 1, 3, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Abadd9:   { frets: [1, 1, 3, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Aadd9:    { frets: [2, 2, 4, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "A#add9": { frets: [3, 3, 5, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Bbadd9:   { frets: [3, 3, 5, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    Badd9:    { frets: [4, 4, 6, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },

    // ── Augmented ─────────────────────────────────────────────────
    Caug:     { frets: [0, 1, 0, 2] },
    "C#aug":  { frets: [1, 2, 1, 3] },
    Dbaug:    { frets: [1, 2, 1, 3] },
    Daug:     { frets: [0, 3, 3, 2] },
    "D#aug":  { frets: [1, 4, 4, 3] },
    Ebaug:    { frets: [1, 4, 4, 3] },
    Eaug:     { frets: [2, 1, 1, 2] },
    Faug:     { frets: [3, 2, 2, 3] },
    "F#aug":  { frets: [0, 3, 3, 4] },
    Gbaug:    { frets: [0, 3, 3, 4] },
    Gaug:     { frets: [0, 1, 0, 0] },
    "G#aug":  { frets: [1, 2, 1, 1] },
    Abaug:    { frets: [1, 2, 1, 1] },
    Aaug:     { frets: [2, 3, 2, 2] },
    "A#aug":  { frets: [3, 4, 3, 3], baseFret: 3 },
    Bbaug:    { frets: [3, 4, 3, 3], baseFret: 3 },
    Baug:     { frets: [4, 5, 4, 4], baseFret: 4 },
  },

  ukulele: {
    // ═══════════════════════════════════════════════════════════════
    // UKULELE — 4 strings (G-C-E-A tuning), index 0–3
    // ═══════════════════════════════════════════════════════════════

    // ── Major ─────────────────────────────────────────────────────
    C:    { frets: [0, 0, 0, 3] },
    "C#": { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    Db:   { frets: [1, 1, 1, 4], barres: [{ fret: 1, from: 0, to: 2 }] },
    D:    { frets: [2, 2, 2, 0] },
    "D#": { frets: [3, 3, 3, 1] },
    Eb:   { frets: [3, 3, 3, 1] },
    E:    { frets: [1, 4, 0, 2] },
    F:    { frets: [2, 0, 1, 0] },
    "F#": { frets: [3, 1, 2, 1] },
    Gb:   { frets: [3, 1, 2, 1] },
    G:    { frets: [0, 2, 3, 2] },
    "G#": { frets: [5, 3, 4, 3], baseFret: 3 },
    Ab:   { frets: [5, 3, 4, 3], baseFret: 3 },
    A:    { frets: [2, 1, 0, 0] },
    "A#": { frets: [3, 2, 1, 1] },
    Bb:   { frets: [3, 2, 1, 1] },
    B:    { frets: [4, 3, 2, 2] },

    // ── Minor ─────────────────────────────────────────────────────
    Cm:   { frets: [0, 3, 3, 3] },
    "C#m":{ frets: [1, 4, 4, 4], barres: [{ fret: 1, from: 0, to: 0 }] },
    Dbm:  { frets: [1, 4, 4, 4] },
    Dm:   { frets: [2, 2, 1, 0] },
    "D#m":{ frets: [3, 3, 2, 1] },
    Ebm:  { frets: [3, 3, 2, 1] },
    Em:   { frets: [0, 4, 3, 2] },
    Fm:   { frets: [1, 0, 1, 3] },
    "F#m":{ frets: [2, 1, 2, 0] },
    Gbm:  { frets: [2, 1, 2, 0] },
    Gm:   { frets: [0, 2, 3, 1] },
    "G#m":{ frets: [4, 3, 4, 2] },
    Abm:  { frets: [4, 3, 4, 2] },
    Am:   { frets: [2, 0, 0, 0] },
    "A#m":{ frets: [3, 1, 1, 1] },
    Bbm:  { frets: [3, 1, 1, 1] },
    Bm:   { frets: [4, 2, 2, 2] },

    // ── Dominant 7th ──────────────────────────────────────────────
    C7:   { frets: [0, 0, 0, 1] },
    "C#7":{ frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    Db7:  { frets: [1, 1, 1, 2], barres: [{ fret: 1, from: 0, to: 2 }] },
    D7:   { frets: [2, 2, 2, 3] },
    "D#7":{ frets: [3, 3, 3, 4] },
    Eb7:  { frets: [3, 3, 3, 4] },
    E7:   { frets: [1, 2, 0, 2] },
    F7:   { frets: [2, 3, 1, 3] },
    "F#7":{ frets: [3, 4, 2, 4] },
    Gb7:  { frets: [3, 4, 2, 4] },
    G7:   { frets: [0, 2, 1, 2] },
    "G#7":{ frets: [1, 3, 2, 3] },
    Ab7:  { frets: [1, 3, 2, 3] },
    A7:   { frets: [0, 1, 0, 0] },
    "A#7":{ frets: [1, 2, 1, 1] },
    Bb7:  { frets: [1, 2, 1, 1] },
    B7:   { frets: [2, 3, 2, 2] },

    // ── Minor 7th ─────────────────────────────────────────────────
    Cm7:  { frets: [3, 3, 3, 4] },
    "C#m7":{ frets: [4, 4, 4, 5], baseFret: 4 },
    Dbm7: { frets: [4, 4, 4, 5], baseFret: 4 },
    Dm7:  { frets: [2, 2, 1, 3] },
    "D#m7":{ frets: [3, 3, 2, 4] },
    Ebm7: { frets: [3, 3, 2, 4] },
    Em7:  { frets: [0, 2, 0, 2] },
    Fm7:  { frets: [1, 3, 1, 3] },
    "F#m7":{ frets: [2, 4, 2, 4] },
    Gbm7: { frets: [2, 4, 2, 4] },
    Gm7:  { frets: [0, 2, 1, 1] },
    "G#m7":{ frets: [1, 3, 2, 2] },
    Abm7: { frets: [1, 3, 2, 2] },
    Am7:  { frets: [0, 0, 0, 0] },
    "A#m7":{ frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Bbm7: { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    Bm7:  { frets: [2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },

    // ── Major 7th ─────────────────────────────────────────────────
    CM7:    { frets: [0, 0, 0, 2] },
    Cmaj7:  { frets: [0, 0, 0, 2] },
    "C#M7": { frets: [1, 1, 1, 3] },
    "C#maj7":{ frets: [1, 1, 1, 3] },
    DbM7:   { frets: [1, 1, 1, 3] },
    Dbmaj7: { frets: [1, 1, 1, 3] },
    DM7:    { frets: [2, 2, 2, 4] },
    Dmaj7:  { frets: [2, 2, 2, 4] },
    "D#M7": { frets: [3, 3, 3, 5] },
    "D#maj7":{ frets: [3, 3, 3, 5] },
    EbM7:   { frets: [3, 3, 3, 5] },
    Ebmaj7: { frets: [3, 3, 3, 5] },
    EM7:    { frets: [1, 3, 0, 2] },
    Emaj7:  { frets: [1, 3, 0, 2] },
    FM7:    { frets: [2, 4, 1, 3] },
    Fmaj7:  { frets: [2, 4, 1, 3] },
    "F#M7": { frets: [3, 1, 2, 1] },
    "F#maj7":{ frets: [3, 1, 2, 1] },
    GbM7:   { frets: [3, 1, 2, 1] },
    Gbmaj7: { frets: [3, 1, 2, 1] },
    GM7:    { frets: [0, 2, 2, 2] },
    Gmaj7:  { frets: [0, 2, 2, 2] },
    "G#M7": { frets: [1, 3, 3, 3] },
    "G#maj7":{ frets: [1, 3, 3, 3] },
    AbM7:   { frets: [1, 3, 3, 3] },
    Abmaj7: { frets: [1, 3, 3, 3] },
    AM7:    { frets: [1, 1, 0, 0] },
    Amaj7:  { frets: [1, 1, 0, 0] },
    "A#M7": { frets: [2, 2, 1, 1] },
    "A#maj7":{ frets: [2, 2, 1, 1] },
    BbM7:   { frets: [2, 2, 1, 1] },
    Bbmaj7: { frets: [2, 2, 1, 1] },
    BM7:    { frets: [3, 3, 2, 2] },
    Bmaj7:  { frets: [3, 3, 2, 2] },

    // ── Suspended 4 ───────────────────────────────────────────────
    Csus4:    { frets: [0, 0, 1, 3] },
    "C#sus4": { frets: [1, 1, 2, 4] },
    Dbsus4:   { frets: [1, 1, 2, 4] },
    Dsus4:    { frets: [0, 2, 3, 3] },
    "D#sus4": { frets: [1, 3, 4, 4] },
    Ebsus4:   { frets: [1, 3, 4, 4] },
    Esus4:    { frets: [2, 4, 0, 2] },
    Fsus4:    { frets: [0, 0, 1, 3] },
    "F#sus4": { frets: [3, 1, 3, 2] },
    Gbsus4:   { frets: [3, 1, 3, 2] },
    Gsus4:    { frets: [0, 2, 3, 3] },
    "G#sus4": { frets: [1, 3, 4, 4] },
    Absus4:   { frets: [1, 3, 4, 4] },
    Asus4:    { frets: [2, 2, 0, 0] },
    "A#sus4": { frets: [3, 3, 1, 1] },
    Bbsus4:   { frets: [3, 3, 1, 1] },
    Bsus4:    { frets: [4, 4, 2, 2] },

    // ── Suspended 2 ───────────────────────────────────────────────
    Csus2:    { frets: [0, 2, 0, 3] },
    "C#sus2": { frets: [1, 3, 1, 4] },
    Dbsus2:   { frets: [1, 3, 1, 4] },
    Dsus2:    { frets: [2, 2, 0, 0] },
    "D#sus2": { frets: [3, 3, 1, 1] },
    Ebsus2:   { frets: [3, 3, 1, 1] },
    Esus2:    { frets: [4, 4, 0, 2] },
    Fsus2:    { frets: [0, 0, 1, 0] },
    "F#sus2": { frets: [3, 1, 0, 1] },
    Gbsus2:   { frets: [3, 1, 0, 1] },
    Gsus2:    { frets: [0, 2, 3, 0] },
    "G#sus2": { frets: [1, 3, 4, 1] },
    Absus2:   { frets: [1, 3, 4, 1] },
    Asus2:    { frets: [2, 2, 0, 2] },
    "A#sus2": { frets: [3, 3, 1, 3] },
    Bbsus2:   { frets: [3, 3, 1, 3] },
    Bsus2:    { frets: [4, 4, 2, 4] },

    // ── Diminished ────────────────────────────────────────────────
    Cdim:     { frets: [2, 3, 2, 3] },
    "C#dim":  { frets: [3, 4, 3, 4] },
    Dbdim:    { frets: [3, 4, 3, 4] },
    Ddim:     { frets: [1, 2, 1, 3] },
    "D#dim":  { frets: [2, 3, 2, 4] },
    Ebdim:    { frets: [2, 3, 2, 4] },
    Edim:     { frets: [0, 1, 0, 2] },
    Fdim:     { frets: [1, 2, 1, 3] },
    "F#dim":  { frets: [2, 3, 2, 0] },
    Gbdim:    { frets: [2, 3, 2, 0] },
    Gdim:     { frets: [0, 1, 3, 1] },
    "G#dim":  { frets: [1, 2, 4, 2] },
    Abdim:    { frets: [1, 2, 4, 2] },
    Adim:     { frets: [2, 3, 2, 3] },
    "A#dim":  { frets: [0, 1, 0, 1] },
    Bbdim:    { frets: [0, 1, 0, 1] },
    Bdim:     { frets: [1, 2, 1, 2] },

    // ── m7b5 ──────────────────────────────────────────────────────
    Cm7b5:    { frets: [2, 3, 2, 4] },
    "C#m7b5": { frets: [3, 4, 3, 5] },
    Dbm7b5:   { frets: [3, 4, 3, 5] },
    Dm7b5:    { frets: [1, 2, 1, 3] },
    "D#m7b5": { frets: [2, 3, 2, 4] },
    Ebm7b5:   { frets: [2, 3, 2, 4] },
    Em7b5:    { frets: [0, 1, 0, 2] },
    Fm7b5:    { frets: [1, 2, 1, 3] },
    "F#m7b5": { frets: [2, 3, 0, 2] },
    Gbm7b5:   { frets: [2, 3, 0, 2] },
    Gm7b5:    { frets: [0, 1, 1, 1] },
    "G#m7b5": { frets: [1, 2, 2, 2] },
    Abm7b5:   { frets: [1, 2, 2, 2] },
    Am7b5:    { frets: [0, 0, 0, 1] },
    "A#m7b5": { frets: [1, 1, 1, 2] },
    Bbm7b5:   { frets: [1, 1, 1, 2] },
    Bm7b5:    { frets: [2, 2, 2, 3] },

    // ── Add9 ──────────────────────────────────────────────────────
    Cadd9:    { frets: [0, 2, 0, 3] },
    "C#add9": { frets: [1, 3, 1, 4] },
    Dbadd9:   { frets: [1, 3, 1, 4] },
    Dadd9:    { frets: [2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    "D#add9": { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }] },
    Ebadd9:   { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }] },
    Eadd9:    { frets: [4, 4, 0, 2] },
    Fadd9:    { frets: [0, 0, 1, 0] },
    "F#add9": { frets: [3, 1, 2, 3] },
    Gbadd9:   { frets: [3, 1, 2, 3] },
    Gadd9:    { frets: [0, 2, 3, 0] },
    "G#add9": { frets: [1, 3, 4, 1] },
    Abadd9:   { frets: [1, 3, 4, 1] },
    Aadd9:    { frets: [2, 1, 2, 0] },
    "A#add9": { frets: [3, 2, 3, 1] },
    Bbadd9:   { frets: [3, 2, 3, 1] },
    Badd9:    { frets: [4, 3, 4, 2] },

    // ── Augmented ─────────────────────────────────────────────────
    Caug:     { frets: [1, 0, 0, 3] },
    "C#aug":  { frets: [2, 1, 1, 4] },
    Dbaug:    { frets: [2, 1, 1, 4] },
    Daug:     { frets: [3, 2, 2, 1] },
    "D#aug":  { frets: [0, 3, 3, 2] },
    Ebaug:    { frets: [0, 3, 3, 2] },
    Eaug:     { frets: [1, 0, 0, 3] },
    Faug:     { frets: [2, 1, 1, 4] },
    "F#aug":  { frets: [3, 2, 2, 1] },
    Gbaug:    { frets: [3, 2, 2, 1] },
    Gaug:     { frets: [0, 3, 3, 2] },
    "G#aug":  { frets: [1, 0, 0, 3] },
    Abaug:    { frets: [1, 0, 0, 3] },
    Aaug:     { frets: [2, 1, 1, 0] },
    "A#aug":  { frets: [3, 2, 2, 1] },
    Bbaug:    { frets: [3, 2, 2, 1] },
    Baug:     { frets: [0, 3, 3, 0] },
  },
};

// ─── Alternative Voicings Database ───────────────────────────────
// Each key maps to an ARRAY of alternative positions (the primary is in CHORD_DB above)
const CHORD_ALT_VOICINGS: Record<string, Record<string, ChordVoicing[]>> = {
  guitar: {
    // ── Major alternatives ─────────────────────────────────────
    C:    [
      { frets: [3, 3, 5, 5, 5, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
      { frets: [-1, 3, 2, 0, 1, 3] },
    ],
    D:    [
      { frets: [-1, 5, 7, 7, 7, 5], barres: [{ fret: 5, from: 1, to: 5 }], baseFret: 5 },
      { frets: [-1, -1, 0, 2, 3, 5] },
    ],
    E:    [
      { frets: [-1, 7, 9, 9, 9, 7], barres: [{ fret: 7, from: 1, to: 5 }], baseFret: 7 },
      { frets: [0, 2, 2, 4, 5, 4], baseFret: 1 },
    ],
    F:    [
      { frets: [-1, -1, 3, 2, 1, 1] },
      { frets: [-1, 8, 10, 10, 10, 8], barres: [{ fret: 8, from: 1, to: 5 }], baseFret: 8 },
    ],
    G:    [
      { frets: [3, 5, 5, 4, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
      { frets: [3, 2, 0, 0, 3, 3] },
    ],
    A:    [
      { frets: [-1, 0, 2, 2, 2, 5] },
      { frets: [5, 5, 7, 7, 7, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
    ],
    B:    [
      { frets: [7, 7, 9, 9, 9, 7], barres: [{ fret: 7, from: 0, to: 5 }], baseFret: 7 },
      { frets: [-1, 2, 4, 4, 4, -1], barres: [{ fret: 2, from: 1, to: 1 }] },
    ],

    // ── Minor alternatives ────────────────────────────────────
    Am:   [
      { frets: [5, 5, 7, 7, 6, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
      { frets: [-1, 0, 2, 2, 1, 3] },
    ],
    Em:   [
      { frets: [-1, 7, 9, 9, 8, 7], barres: [{ fret: 7, from: 1, to: 5 }], baseFret: 7 },
      { frets: [0, 2, 2, 0, 3, 0] },
    ],
    Dm:   [
      { frets: [-1, 5, 7, 7, 6, 5], barres: [{ fret: 5, from: 1, to: 5 }], baseFret: 5 },
      { frets: [-1, -1, 0, 2, 3, 5] },
    ],
    Bm:   [
      { frets: [7, 7, 9, 9, 8, 7], barres: [{ fret: 7, from: 0, to: 5 }], baseFret: 7 },
    ],

    // ── Dominant 7 alternatives ───────────────────────────────
    A7:   [
      { frets: [5, 5, 7, 5, 7, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
      { frets: [-1, 0, 2, 2, 2, 3] },
    ],
    E7:   [
      { frets: [0, 2, 2, 1, 3, 0] },
      { frets: [-1, 7, 9, 7, 9, 7], barres: [{ fret: 7, from: 1, to: 5 }], baseFret: 7 },
    ],
    D7:   [
      { frets: [-1, -1, 0, 2, 1, 5] },
      { frets: [-1, 5, 7, 5, 7, 5], barres: [{ fret: 5, from: 1, to: 5 }], baseFret: 5 },
    ],
    G7:   [
      { frets: [3, 2, 0, 0, 0, 3] },
      { frets: [3, 5, 3, 4, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }], baseFret: 3 },
    ],
    C7:   [
      { frets: [-1, 3, 5, 3, 5, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    ],
    B7:   [
      { frets: [-1, 2, 4, 2, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
      { frets: [7, 7, 9, 7, 9, 7], barres: [{ fret: 7, from: 0, to: 5 }], baseFret: 7 },
    ],

    // ── Minor 7 alternatives ──────────────────────────────────
    Am7:  [
      { frets: [5, 5, 7, 5, 6, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
      { frets: [-1, 0, 2, 2, 1, 3] },
    ],
    Em7:  [
      { frets: [0, 2, 2, 0, 3, 0] },
      { frets: [0, 2, 0, 0, 3, 0] },
    ],
    Dm7:  [
      { frets: [-1, 5, 7, 5, 6, 5], barres: [{ fret: 5, from: 1, to: 5 }], baseFret: 5 },
    ],

    // ── Maj7 alternatives ─────────────────────────────────────
    CM7:  [
      { frets: [-1, 3, 5, 4, 5, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    ],
    Cmaj7:[
      { frets: [-1, 3, 5, 4, 5, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    ],
    GM7:  [
      { frets: [3, 2, 0, 0, 0, 2] },
    ],
    AM7:  [
      { frets: [5, 5, 7, 6, 7, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
    ],
    FM7:  [
      { frets: [-1, -1, 3, 2, 1, 0] },
    ],
    Fmaj7:[
      { frets: [-1, -1, 3, 2, 1, 0] },
    ],

    // ── Sus4 alternatives ─────────────────────────────────────
    Dsus4: [
      { frets: [-1, 5, 7, 7, 8, 5], barres: [{ fret: 5, from: 1, to: 5 }], baseFret: 5 },
    ],
    Asus4: [
      { frets: [5, 5, 7, 7, 8, 5], barres: [{ fret: 5, from: 0, to: 5 }], baseFret: 5 },
    ],
    Esus4: [
      { frets: [0, 2, 2, 2, 0, 2] },
    ],
  },
  cavaquinho: {
    // ── Major alternatives ─────────────────────────────────────
    C:    [
      { frets: [5, 5, 5, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 5 },
      { frets: [0, 3, 0, 2] },
    ],
    D:    [
      { frets: [5, 5, 3, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 3 },
      { frets: [0, 2, 0, 2] },
    ],
    E:    [
      { frets: [4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },
      { frets: [2, 4, 5, 4], baseFret: 2 },
    ],
    F:    [
      { frets: [0, 2, 1, 0] },
      { frets: [5, 5, 5, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 5 },
    ],
    G:    [
      { frets: [5, 5, 4, 3], baseFret: 3 },
      { frets: [0, 4, 3, 3], baseFret: 3 },
    ],
    A:    [
      { frets: [2, 4, 5, 4], baseFret: 2 },
      { frets: [0, 2, 2, 2] },
    ],
    B:    [
      { frets: [2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    ],
    Bb:   [
      { frets: [1, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] },
    ],

    // ── Minor alternatives ────────────────────────────────────
    Cm:   [
      { frets: [5, 5, 4, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 3 },
    ],
    Dm:   [
      { frets: [5, 5, 3, 4], baseFret: 3 },
      { frets: [0, 2, 0, 1] },
    ],
    Em:   [
      { frets: [4, 4, 3, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },
      { frets: [0, 4, 5, 4], baseFret: 2 },
    ],
    Fm:   [
      { frets: [0, 1, 1, 0], barres: [{ fret: 1, from: 1, to: 2 }] },
    ],
    Gm:   [
      { frets: [5, 5, 3, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 3 },
    ],
    Am:   [
      { frets: [0, 2, 1, 2] },
      { frets: [4, 4, 3, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 2 },
    ],
    Bm:   [
      { frets: [2, 2, 1, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    ],

    // ── Dominant 7 alternatives ───────────────────────────────
    C7:   [
      { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    ],
    D7:   [
      { frets: [5, 5, 4, 5], barres: [{ fret: 5, from: 0, to: 3 }], baseFret: 3 },
    ],
    E7:   [
      { frets: [4, 4, 3, 3], baseFret: 2 },
    ],
    G7:   [
      { frets: [3, 3, 3, 5], barres: [{ fret: 3, from: 0, to: 2 }], baseFret: 3 },
    ],
    A7:   [
      { frets: [0, 2, 2, 0] },
    ],
    B7:   [
      { frets: [2, 2, 2, 0] },
    ],

    // ── Minor 7 alternatives ──────────────────────────────────
    Am7:  [
      { frets: [0, 2, 1, 0] },
    ],
    Dm7:  [
      { frets: [3, 5, 4, 4], baseFret: 3 },
    ],
    Em7:  [
      { frets: [4, 4, 3, 3], baseFret: 2 },
    ],

    // ── Maj7 alternatives ─────────────────────────────────────
    CM7:  [
      { frets: [5, 5, 5, 4], baseFret: 3 },
    ],
    Cmaj7:[
      { frets: [5, 5, 5, 4], baseFret: 3 },
    ],
    GM7:  [
      { frets: [5, 5, 4, 4], baseFret: 3 },
    ],
    Gmaj7:[
      { frets: [5, 5, 4, 4], baseFret: 3 },
    ],
    FM7:  [
      { frets: [0, 2, 1, 1] },
    ],
    Fmaj7:[
      { frets: [0, 2, 1, 1] },
    ],

    // ── Sus4 alternatives ─────────────────────────────────────
    Csus4: [{ frets: [0, 3, 1, 3] }],
    Dsus4: [{ frets: [0, 2, 0, 3] }],
    Esus4: [{ frets: [2, 4, 5, 5], baseFret: 2 }],
    Fsus4: [{ frets: [0, 3, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    Gsus4: [{ frets: [0, 5, 3, 3], baseFret: 3 }],
    Asus4: [{ frets: [0, 2, 2, 3] }],
    Bsus4: [{ frets: [2, 2, 2, 3], barres: [{ fret: 2, from: 0, to: 2 }] }],

    // ── Dim alternatives ──────────────────────────────────────
    Cdim: [{ frets: [2, 3, 2, 3] }],
    Ddim: [{ frets: [4, 5, 4, 5], baseFret: 2 }],
    Edim: [{ frets: [1, 2, 1, 2] }],
    Fdim: [{ frets: [2, 3, 2, 3], baseFret: 2 }],
    Gdim: [{ frets: [4, 5, 4, 5], baseFret: 4 }],
    Adim: [{ frets: [1, 2, 1, 2], baseFret: 4 }],
    Bdim: [{ frets: [1, 2, 1, 2], baseFret: 2 }],

    // ── Add9 alternatives ─────────────────────────────────────
    Cadd9: [{ frets: [0, 3, 0, 3] }],
    Dadd9: [{ frets: [0, 4, 0, 2] }],
    Eadd9: [{ frets: [4, 4, 4, 2], barres: [{ fret: 4, from: 0, to: 2 }] }],
    Fadd9: [{ frets: [0, 2, 1, 3] }],
    Gadd9: [{ frets: [0, 5, 3, 5], baseFret: 3 }],
    Aadd9: [{ frets: [0, 2, 2, 4] }],

    // ── Aug alternatives ──────────────────────────────────────
    Caug: [{ frets: [1, 3, 1, 2] }],
    Daug: [{ frets: [3, 5, 3, 4], baseFret: 2 }],
    Eaug: [{ frets: [1, 4, 4, 4], barres: [{ fret: 4, from: 1, to: 3 }] }],
    Faug: [{ frets: [2, 1, 1, 2] }],
    Gaug: [{ frets: [0, 4, 4, 3], baseFret: 3 }],
    Aaug: [{ frets: [2, 1, 1, 2], baseFret: 4 }],
    Baug: [{ frets: [0, 3, 3, 2] }],

    // ── 9 (Dominant 9) alternatives ───────────────────────────
    C9:   [{ frets: [0, 3, 0, 2] }],
    D9:   [{ frets: [0, 4, 0, 2] }],
    E9:   [{ frets: [2, 4, 3, 4], baseFret: 2 }],
    F9:   [{ frets: [0, 2, 1, 3] }],
    G9:   [{ frets: [0, 5, 3, 5], baseFret: 3 }],
    A9:   [{ frets: [0, 2, 2, 4] }],
    B9:   [{ frets: [2, 2, 2, 4], barres: [{ fret: 2, from: 0, to: 2 }] }],

    // ── 7sus4 alternatives ────────────────────────────────────
    C7sus4:[{ frets: [0, 3, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    D7sus4:[{ frets: [0, 2, 0, 1] }],
    E7sus4:[{ frets: [2, 4, 5, 3], baseFret: 2 }],
    F7sus4:[{ frets: [0, 3, 1, 0] }],
    G7sus4:[{ frets: [0, 5, 3, 1], baseFret: 3 }],
    A7sus4:[{ frets: [0, 2, 2, 3] }],
    B7sus4:[{ frets: [2, 2, 2, 3], barres: [{ fret: 2, from: 0, to: 2 }] }],

    // ── Dim7 alternatives ─────────────────────────────────────
    Cdim7: [{ frets: [2, 3, 2, 0] }],
    Ddim7: [{ frets: [4, 5, 4, 2], baseFret: 2 }],
    Edim7: [{ frets: [1, 2, 1, 2] }],
    Fdim7: [{ frets: [2, 3, 2, 3], baseFret: 2 }],
    Gdim7: [{ frets: [0, 4, 3, 4], baseFret: 3 }],
    Adim7: [{ frets: [1, 2, 1, 2], baseFret: 4 }],
    Bdim7: [{ frets: [1, 2, 1, 2], baseFret: 2 }],

    // ── Sus2 alternatives ─────────────────────────────────────
    Csus2: [{ frets: [0, 3, 0, 3] }],
    Dsus2: [{ frets: [0, 4, 0, 0] }],
    Esus2: [{ frets: [4, 4, 4, 1], barres: [{ fret: 4, from: 0, to: 2 }] }],
    Fsus2: [{ frets: [0, 3, 1, 3] }],
    Gsus2: [{ frets: [0, 5, 3, 0], baseFret: 3 }],
    Asus2: [{ frets: [0, 2, 2, 4] }],
    Bsus2: [{ frets: [2, 2, 1, 4], baseFret: 2 }],

    // ── m7b5 (Half-diminished) alternatives ───────────────────
    "Cm7b5": [{ frets: [2, 3, 2, 1] }],
    "Dm7b5": [{ frets: [4, 5, 4, 3], baseFret: 2 }],
    "Em7b5": [{ frets: [1, 2, 1, 0] }],
    "Fm7b5": [{ frets: [2, 3, 2, 1], baseFret: 2 }],
    "Gm7b5": [{ frets: [0, 4, 3, 1], baseFret: 3 }],
    "Am7b5": [{ frets: [1, 2, 1, 0], baseFret: 4 }],
    "Bm7b5": [{ frets: [1, 2, 1, 0], baseFret: 2 }],

    // ── 6 (Major 6) alternatives ──────────────────────────────
    C6:   [{ frets: [0, 3, 0, 4] }],
    D6:   [{ frets: [0, 2, 0, 4] }],
    E6:   [{ frets: [4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 2 }],
    F6:   [{ frets: [0, 2, 1, 2] }],
    G6:   [{ frets: [0, 5, 3, 4], baseFret: 3 }],
    A6:   [{ frets: [0, 2, 2, 1] }],
    B6:   [{ frets: [2, 2, 2, 1], barres: [{ fret: 2, from: 0, to: 2 }] }],

    // ── m6 (Minor 6) alternatives ─────────────────────────────
    Cm6:  [{ frets: [2, 3, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    Dm6:  [{ frets: [0, 2, 0, 4] }],
    Em6:  [{ frets: [4, 4, 3, 4], baseFret: 2 }],
    Fm6:  [{ frets: [0, 1, 1, 2] }],
    Gm6:  [{ frets: [0, 5, 3, 1], baseFret: 3 }],
    Am6:  [{ frets: [0, 2, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    Bm6:  [{ frets: [2, 2, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
  },
  ukulele: {
    // ── Major alternatives ─────────────────────────────────────
    C:  [
      { frets: [5, 4, 3, 3], baseFret: 3 },
      { frets: [0, 0, 0, 7], baseFret: 5 },
    ],
    D:  [
      { frets: [2, 2, 2, 5], barres: [{ fret: 2, from: 0, to: 2 }], baseFret: 2 },
      { frets: [7, 6, 5, 5], baseFret: 5 },
    ],
    E:  [
      { frets: [4, 4, 4, 2], barres: [{ fret: 4, from: 0, to: 2 }] },
      { frets: [1, 4, 0, 2] },
    ],
    F:  [
      { frets: [2, 0, 1, 3] },
      { frets: [5, 5, 5, 8], barres: [{ fret: 5, from: 0, to: 2 }], baseFret: 5 },
    ],
    G:  [
      { frets: [0, 2, 3, 5] },
      { frets: [4, 2, 3, 2] },
    ],
    A:  [
      { frets: [2, 1, 0, 4] },
      { frets: [6, 4, 5, 4], baseFret: 4 },
    ],
    B:  [
      { frets: [4, 3, 2, 2] },
      { frets: [4, 4, 4, 6], barres: [{ fret: 4, from: 0, to: 2 }], baseFret: 4 },
    ],
    Bb: [
      { frets: [3, 2, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] },
    ],

    // ── Minor alternatives ────────────────────────────────────
    Am: [
      { frets: [2, 4, 4, 5], baseFret: 2 },
      { frets: [0, 0, 0, 5], baseFret: 3 },
    ],
    Em: [
      { frets: [0, 4, 3, 2] },
      { frets: [4, 4, 3, 0] },
    ],
    Dm: [
      { frets: [2, 2, 1, 0] },
      { frets: [7, 5, 6, 5], baseFret: 5 },
    ],
    Bm: [
      { frets: [4, 2, 2, 2], barres: [{ fret: 2, from: 1, to: 3 }] },
    ],
    Gm: [
      { frets: [0, 2, 3, 1] },
      { frets: [3, 5, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    ],
    Fm: [
      { frets: [1, 0, 1, 3] },
      { frets: [3, 1, 1, 1], barres: [{ fret: 1, from: 1, to: 3 }] },
    ],
    Cm: [
      { frets: [0, 3, 3, 3], barres: [{ fret: 3, from: 1, to: 3 }] },
      { frets: [5, 3, 3, 3], barres: [{ fret: 3, from: 1, to: 3 }], baseFret: 3 },
    ],

    // ── Dominant 7 alternatives ───────────────────────────────
    C7: [
      { frets: [0, 0, 0, 1] },
      { frets: [3, 4, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    ],
    G7: [
      { frets: [0, 2, 1, 2] },
      { frets: [4, 2, 3, 2] },
    ],
    D7: [
      { frets: [2, 2, 2, 3], barres: [{ fret: 2, from: 0, to: 2 }] },
    ],
    A7: [
      { frets: [0, 1, 0, 0] },
      { frets: [0, 1, 0, 4] },
    ],
    E7: [
      { frets: [1, 2, 0, 2] },
      { frets: [4, 4, 4, 5], barres: [{ fret: 4, from: 0, to: 2 }], baseFret: 4 },
    ],
    B7: [
      { frets: [2, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    ],
    F7: [
      { frets: [2, 3, 1, 3] },
    ],

    // ── Minor 7 alternatives ──────────────────────────────────
    Am7: [
      { frets: [0, 0, 0, 0] },
      { frets: [0, 4, 3, 3], baseFret: 3 },
    ],
    Em7: [
      { frets: [0, 2, 0, 2] },
    ],
    Dm7: [
      { frets: [2, 2, 1, 3] },
    ],
    Gm7: [
      { frets: [0, 2, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] },
    ],

    // ── Maj7 alternatives ─────────────────────────────────────
    CM7:  [
      { frets: [0, 0, 0, 2] },
    ],
    Cmaj7:[
      { frets: [0, 0, 0, 2] },
    ],
    GM7:  [
      { frets: [0, 2, 2, 2], barres: [{ fret: 2, from: 1, to: 3 }] },
    ],
    Gmaj7:[
      { frets: [0, 2, 2, 2], barres: [{ fret: 2, from: 1, to: 3 }] },
    ],
    FM7:  [
      { frets: [2, 4, 1, 3] },
    ],
    Fmaj7:[
      { frets: [2, 4, 1, 3] },
    ],
    AM7:  [
      { frets: [1, 1, 0, 0] },
    ],
    Amaj7:[
      { frets: [1, 1, 0, 0] },
    ],

    // ── Sus4 alternatives ─────────────────────────────────────
    Csus4: [{ frets: [0, 0, 1, 3] }, { frets: [5, 5, 3, 3], baseFret: 3 }],
    Dsus4: [{ frets: [0, 2, 3, 0] }, { frets: [2, 2, 3, 0] }],
    Esus4: [{ frets: [2, 4, 0, 2] }],
    Fsus4: [{ frets: [1, 0, 1, 3] }, { frets: [3, 3, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    Gsus4: [{ frets: [0, 2, 3, 3], barres: [{ fret: 3, from: 2, to: 3 }] }],
    Asus4: [{ frets: [2, 2, 0, 0], barres: [{ fret: 2, from: 0, to: 1 }] }],
    Bsus4: [{ frets: [4, 4, 2, 2], barres: [{ fret: 2, from: 2, to: 3 }] }],

    // ── Dim alternatives ──────────────────────────────────────
    Cdim: [{ frets: [0, 3, 2, 3] }, { frets: [2, 3, 2, 3], baseFret: 5 }],
    Ddim: [{ frets: [1, 2, 1, 0] }],
    Edim: [{ frets: [0, 3, 2, 0] }],
    Fdim: [{ frets: [1, 0, 1, 2] }],
    Gdim: [{ frets: [0, 1, 0, 1] }],
    Adim: [{ frets: [2, 3, 2, 0] }],
    Bdim: [{ frets: [4, 2, 2, 0] }],
    Bbdim:[{ frets: [3, 1, 0, 1] }],

    // ── Add9 alternatives ─────────────────────────────────────
    Cadd9: [{ frets: [0, 2, 0, 3] }, { frets: [5, 4, 0, 3], baseFret: 3 }],
    Dadd9: [{ frets: [2, 2, 0, 0], barres: [{ fret: 2, from: 0, to: 1 }] }],
    Eadd9: [{ frets: [1, 4, 0, 2] }],
    Fadd9: [{ frets: [0, 0, 1, 3] }],
    Gadd9: [{ frets: [0, 2, 0, 3] }],
    Aadd9: [{ frets: [2, 1, 0, 2] }],

    // ── Aug alternatives ──────────────────────────────────────
    Caug: [{ frets: [1, 0, 0, 3] }, { frets: [5, 4, 4, 3], baseFret: 3 }],
    Daug: [{ frets: [3, 2, 2, 5], baseFret: 2 }],
    Eaug: [{ frets: [1, 0, 0, 3] }],
    Faug: [{ frets: [2, 1, 1, 0] }],
    Gaug: [{ frets: [0, 3, 3, 2] }],
    Aaug: [{ frets: [2, 1, 1, 0], baseFret: 4 }],
    Baug: [{ frets: [0, 3, 3, 2], baseFret: 3 }],

    // ── 9 (Dominant 9) alternatives ───────────────────────────
    C9:   [{ frets: [0, 2, 0, 3] }, { frets: [3, 2, 0, 3] }],
    D9:   [{ frets: [2, 2, 1, 3] }],
    E9:   [{ frets: [1, 2, 0, 2] }],
    F9:   [{ frets: [0, 0, 1, 3] }],
    G9:   [{ frets: [0, 2, 1, 3] }],
    A9:   [{ frets: [0, 1, 0, 2] }],
    B9:   [{ frets: [2, 3, 2, 4], baseFret: 2 }],

    // ── 7sus4 alternatives ────────────────────────────────────
    C7sus4:[{ frets: [0, 0, 1, 1], barres: [{ fret: 1, from: 2, to: 3 }] }],
    D7sus4:[{ frets: [2, 2, 3, 3], barres: [{ fret: 2, from: 0, to: 1 }] }],
    E7sus4:[{ frets: [2, 2, 0, 2], barres: [{ fret: 2, from: 0, to: 1 }] }],
    F7sus4:[{ frets: [1, 0, 1, 1], barres: [{ fret: 1, from: 0, to: 3 }] }],
    G7sus4:[{ frets: [0, 2, 1, 3] }],
    A7sus4:[{ frets: [0, 2, 0, 0] }],
    B7sus4:[{ frets: [4, 4, 2, 2], barres: [{ fret: 4, from: 0, to: 1 }], baseFret: 2 }],

    // ── Dim7 alternatives ─────────────────────────────────────
    Cdim7: [{ frets: [0, 3, 2, 0] }, { frets: [2, 3, 2, 0] }],
    Ddim7: [{ frets: [1, 2, 1, 2] }],
    Edim7: [{ frets: [0, 1, 0, 1] }],
    Fdim7: [{ frets: [1, 2, 1, 2], baseFret: 2 }],
    Gdim7: [{ frets: [0, 1, 0, 1], baseFret: 3 }],
    Adim7: [{ frets: [2, 3, 2, 0] }],
    Bdim7: [{ frets: [1, 2, 1, 2], baseFret: 4 }],
    Bbdim7:[{ frets: [0, 1, 0, 1], baseFret: 2 }],
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
 * Draw a chord diagram on a canvas — Cifra Club style frame
 * with app theme colors. X/O indicators at bottom, bright grid,
 * white dots with dark numbers, thick nut, rectangular barre.
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
  const numFrets = 5;
  const w = canvas.width;
  const h = canvas.height;

  const isFirstPosition = !voicing?.baseFret || voicing.baseFret <= 1;

  // ── Layout constants (Cifra Club style: grid takes most space, indicators at bottom) ──
  const nutH = isFirstPosition ? Math.max(4, Math.round(h * 0.025)) : 0;
  const topPad = Math.round(h * 0.04);
  const bottomIndicatorH = Math.round(h * 0.1);
  const sidePad = Math.round(w * 0.14);
  const baseFretLabelW = !isFirstPosition && voicing?.baseFret ? Math.round(w * 0.1) : 0;
  const effectiveSidePadLeft = sidePad + baseFretLabelW;

  const gridTop = topPad + nutH;
  const gridH = h - gridTop - bottomIndicatorH;
  const gridW = w - effectiveSidePadLeft - sidePad;
  const stringSpacing = gridW / (numStrings - 1);
  const fretSpacing = gridH / numFrets;
  const dotRadius = Math.min(stringSpacing, fretSpacing) * 0.32;

  // ── Cifra Club colors adapted to app theme ──
  const gridLineColor = "hsl(220, 10%, 48%)";       // visible gray lines
  const stringLineColor = "hsl(220, 10%, 45%)";     // slightly lighter strings
  const nutColor = "hsl(220, 10%, 75%)";             // bright nut bar
  const dotColor = "hsl(220, 15%, 88%)";             // white-ish dots (like Cifra Club)
  const dotTextColor = "hsl(220, 20%, 10%)";         // dark numbers on dots
  const barreColor = "hsl(220, 15%, 88%)";           // white barre bar
  const indicatorColor = "hsl(220, 15%, 85%)";       // X/O at bottom
  const mutedColor = "hsl(220, 10%, 55%)";           // X marks slightly dimmer
  const baseFretColor = "hsl(220, 10%, 55%)";
  const unavailableColor = "hsl(220, 10%, 40%)";

  // Clear
  ctx.clearRect(0, 0, w, h);

  // ── Nut (thick bar for first position — Cifra Club style) ──
  if (isFirstPosition) {
    ctx.fillStyle = nutColor;
    const nutY = topPad;
    ctx.fillRect(effectiveSidePadLeft - 1, nutY, gridW + 2, nutH);
  }

  // ── Base fret indicator (e.g. "2fr") ──
  if (!isFirstPosition && voicing?.baseFret) {
    ctx.fillStyle = baseFretColor;
    ctx.font = `600 ${Math.round(fretSpacing * 0.3)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voicing.baseFret}ª`, effectiveSidePadLeft - 4, gridTop + fretSpacing * 0.5);
  }

  // ── Grid: horizontal fret lines ──
  for (let f = 0; f <= numFrets; f++) {
    const y = gridTop + f * fretSpacing;
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = f === 0 && !isFirstPosition ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(effectiveSidePadLeft, y);
    ctx.lineTo(effectiveSidePadLeft + gridW, y);
    ctx.stroke();
  }

  // ── Grid: vertical string lines ──
  for (let s = 0; s < numStrings; s++) {
    const x = effectiveSidePadLeft + s * stringSpacing;
    ctx.strokeStyle = stringLineColor;
    // Outer strings slightly thicker (like real guitar)
    ctx.lineWidth = (s === 0 || s === numStrings - 1) ? 1.2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridTop + gridH);
    ctx.stroke();
  }

  if (!voicing) {
    ctx.fillStyle = unavailableColor;
    ctx.font = `400 ${Math.round(w * 0.065)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Indisponível", w / 2, gridTop + gridH / 2);
    return;
  }

  const fingers = assignFingers(voicing.frets, voicing.barres);

  // ── Barres (Cifra Club style: thick white rectangular bar) ──
  if (voicing.barres) {
    for (const barre of voicing.barres) {
      const relativeFret = voicing.baseFret && voicing.baseFret > 1
        ? barre.fret - voicing.baseFret + 1
        : barre.fret;
      const y = gridTop + (relativeFret - 0.5) * fretSpacing;
      const x1 = effectiveSidePadLeft + barre.from * stringSpacing;
      const x2 = effectiveSidePadLeft + barre.to * stringSpacing;
      const barreH = dotRadius * 1.1;

      // Rectangular barre bar
      ctx.fillStyle = barreColor;
      const rx = 3; // slight rounding
      ctx.beginPath();
      ctx.roundRect(x1 - dotRadius * 0.3, y - barreH / 2, (x2 - x1) + dotRadius * 0.6, barreH, rx);
      ctx.fill();
    }
  }

  // ── Fret dots (Cifra Club: white filled circles with dark finger numbers) ──
  for (let s = 0; s < voicing.frets.length; s++) {
    const fret = voicing.frets[s];
    const x = effectiveSidePadLeft + s * stringSpacing;

    if (fret > 0) {
      const isCoveredByBarre = voicing.barres?.some(
        b => fret === b.fret && s >= b.from && s <= b.to
      );
      if (isCoveredByBarre) continue;

      const relativeFret = voicing.baseFret && voicing.baseFret > 1
        ? fret - voicing.baseFret + 1
        : fret;
      const y = gridTop + (relativeFret - 0.5) * fretSpacing;

      // White filled circle
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Dark finger number
      if (fingers[s] > 0) {
        ctx.fillStyle = dotTextColor;
        ctx.font = `700 ${Math.round(dotRadius * 1.1)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(fingers[s]), x, y + 0.5);
      }
    }
  }

  // ── Bottom indicators: X (muted) and O (open) — Cifra Club style ──
  if (voicing) {
    const indY = gridTop + gridH + bottomIndicatorH * 0.55;
    const indR = Math.max(3.5, dotRadius * 0.5);
    for (let s = 0; s < voicing.frets.length; s++) {
      const fret = voicing.frets[s];
      const x = effectiveSidePadLeft + s * stringSpacing;
      if (fret === -1) {
        // X mark
        ctx.strokeStyle = mutedColor;
        ctx.lineWidth = 1.6;
        const sz = indR * 0.7;
        ctx.beginPath();
        ctx.moveTo(x - sz, indY - sz);
        ctx.lineTo(x + sz, indY + sz);
        ctx.moveTo(x + sz, indY - sz);
        ctx.lineTo(x - sz, indY + sz);
        ctx.stroke();
      } else if (fret === 0) {
        // O mark (open string) — filled dot
        ctx.fillStyle = indicatorColor;
        ctx.beginPath();
        ctx.arc(x, indY, indR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Simplified indicator ──
  if (simplified) {
    ctx.fillStyle = unavailableColor;
    ctx.font = `400 ${Math.round(w * 0.05)}px system-ui, sans-serif`;
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
