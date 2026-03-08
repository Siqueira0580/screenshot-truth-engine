/**
 * Complete harmonic field map for all 12 major and 12 minor keys.
 * Each entry contains the 7 diatonic chords with proper extensions.
 */

export const HARMONIC_FIELDS: Record<string, string[]> = {
  // Major keys (I7M, IIm7, IIIm7, IV7M, V7, VIm7, VIIm7b5)
  C:  ["C7M", "Dm7", "Em7", "F7M", "G7", "Am7", "Bm7(b5)"],
  "C#": ["C#7M", "D#m7", "E#m7", "F#7M", "G#7", "A#m7", "B#m7(b5)"],
  D:  ["D7M", "Em7", "F#m7", "G7M", "A7", "Bm7", "C#m7(b5)"],
  "D#": ["D#7M", "E#m7", "Fxm7", "G#7M", "A#7", "B#m7", "Cxm7(b5)"],
  Eb: ["Eb7M", "Fm7", "Gm7", "Ab7M", "Bb7", "Cm7", "Dm7(b5)"],
  E:  ["E7M", "F#m7", "G#m7", "A7M", "B7", "C#m7", "D#m7(b5)"],
  F:  ["F7M", "Gm7", "Am7", "Bb7M", "C7", "Dm7", "Em7(b5)"],
  "F#": ["F#7M", "G#m7", "A#m7", "B7M", "C#7", "D#m7", "E#m7(b5)"],
  G:  ["G7M", "Am7", "Bm7", "C7M", "D7", "Em7", "F#m7(b5)"],
  "G#": ["G#7M", "A#m7", "B#m7", "C#7M", "D#7", "E#m7", "Fxm7(b5)"],
  Ab: ["Ab7M", "Bbm7", "Cm7", "Db7M", "Eb7", "Fm7", "Gm7(b5)"],
  A:  ["A7M", "Bm7", "C#m7", "D7M", "E7", "F#m7", "G#m7(b5)"],
  "A#": ["A#7M", "B#m7", "Cxm7", "D#7M", "E#7", "Fxm7", "Gxm7(b5)"],
  Bb: ["Bb7M", "Cm7", "Dm7", "Eb7M", "F7", "Gm7", "Am7(b5)"],
  B:  ["B7M", "C#m7", "D#m7", "E7M", "F#7", "G#m7", "A#m7(b5)"],

  // Minor keys (Im7, IIm7b5, bIII7M, IVm7, Vm7, bVI7M, bVII7)
  Cm:  ["Cm7", "Dm7(b5)", "Eb7M", "Fm7", "Gm7", "Ab7M", "Bb7"],
  "C#m": ["C#m7", "D#m7(b5)", "E7M", "F#m7", "G#m7", "A7M", "B7"],
  Dm:  ["Dm7", "Em7(b5)", "F7M", "Gm7", "Am7", "Bb7M", "C7"],
  "D#m": ["D#m7", "E#m7(b5)", "F#7M", "G#m7", "A#m7", "B7M", "C#7"],
  Ebm: ["Ebm7", "Fm7(b5)", "Gb7M", "Abm7", "Bbm7", "Cb7M", "Db7"],
  Em:  ["Em7", "F#m7(b5)", "G7M", "Am7", "Bm7", "C7M", "D7"],
  Fm:  ["Fm7", "Gm7(b5)", "Ab7M", "Bbm7", "Cm7", "Db7M", "Eb7"],
  "F#m": ["F#m7", "G#m7(b5)", "A7M", "Bm7", "C#m7", "D7M", "E7"],
  Gm:  ["Gm7", "Am7(b5)", "Bb7M", "Cm7", "Dm7", "Eb7M", "F7"],
  "G#m": ["G#m7", "A#m7(b5)", "B7M", "C#m7", "D#m7", "E7M", "F#7"],
  Abm: ["Abm7", "Bbm7(b5)", "Cb7M", "Dbm7", "Ebm7", "Fb7M", "Gb7"],
  Am:  ["Am7", "Bm7(b5)", "C7M", "Dm7", "Em7", "F7M", "G7"],
  "A#m": ["A#m7", "B#m7(b5)", "C#7M", "D#m7", "E#m7", "F#7M", "G#7"],
  Bbm: ["Bbm7", "Cm7(b5)", "Db7M", "Ebm7", "Fm7", "Gb7M", "Ab7"],
  Bm:  ["Bm7", "C#m7(b5)", "D7M", "Em7", "F#m7", "G7M", "A7"],
};

const ROMAN_NUMERALS_MAJOR = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const ROMAN_NUMERALS_MINOR = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

export interface Progression {
  name: string;
  numerals: string;
  chords: string[];
}

/**
 * Generate real chord progressions based on the current key's harmonic field.
 */
export function getProgressions(key: string): Progression[] {
  const field = HARMONIC_FIELDS[key];
  if (!field) return [];

  const isMinor = key.endsWith("m");

  if (isMinor) {
    return [
      {
        name: "Cadência Pop Menor",
        numerals: "i – VI – III – VII",
        chords: [field[0], field[5], field[2], field[6]],
      },
      {
        name: "Cadência Emotiva",
        numerals: "i – iv – VII – III",
        chords: [field[0], field[3], field[6], field[2]],
      },
      {
        name: "Cadência Clássica",
        numerals: "i – iv – v – i",
        chords: [field[0], field[3], field[4], field[0]],
      },
      {
        name: "Andaluza",
        numerals: "i – VII – VI – V",
        chords: [field[0], field[6], field[5], field[4]],
      },
    ];
  }

  return [
    {
      name: "Cadência Pop",
      numerals: "I – V – vi – IV",
      chords: [field[0], field[4], field[5], field[3]],
    },
    {
      name: "Cadência Jazz (ii-V-I)",
      numerals: "ii – V – I",
      chords: [field[1], field[4], field[0]],
    },
    {
      name: "Cadência Melancólica",
      numerals: "vi – IV – I – V",
      chords: [field[5], field[3], field[0], field[4]],
    },
    {
      name: "Cadência Clássica",
      numerals: "I – IV – V – I",
      chords: [field[0], field[3], field[4], field[0]],
    },
  ];
}

/**
 * Get the roman numeral label for a chord's position in the field.
 */
export function getRomanNumeral(index: number, isMinor: boolean): string {
  return isMinor ? ROMAN_NUMERALS_MINOR[index] : ROMAN_NUMERALS_MAJOR[index];
}
