/**
 * Chord diagram data and canvas drawing for Guitar, Cavaquinho, Ukulele, and Keyboard.
 */

export type Instrument = "guitar" | "cavaquinho" | "ukulele" | "keyboard";

interface ChordVoicing {
  frets: (number | -1)[]; // -1 = muted, 0 = open
  barres?: { fret: number; from: number; to: number }[];
  baseFret?: number;
}

// Simplified chord database — covers most common chords
const CHORD_DB: Record<string, Record<string, ChordVoicing>> = {
  guitar: {
    C:  { frets: [-1, 3, 2, 0, 1, 0] },
    D:  { frets: [-1, -1, 0, 2, 3, 2] },
    E:  { frets: [0, 2, 2, 1, 0, 0] },
    F:  { frets: [1, 1, 2, 3, 3, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    G:  { frets: [3, 2, 0, 0, 0, 3] },
    A:  { frets: [-1, 0, 2, 2, 2, 0] },
    B:  { frets: [-1, 2, 4, 4, 4, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
    Am: { frets: [-1, 0, 2, 2, 1, 0] },
    Bm: { frets: [-1, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
    Cm: { frets: [-1, 3, 5, 5, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }], baseFret: 3 },
    Dm: { frets: [-1, -1, 0, 2, 3, 1] },
    Em: { frets: [0, 2, 2, 0, 0, 0] },
    Fm: { frets: [1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
    Gm: { frets: [3, 1, 0, 0, 3, 3], baseFret: 3 },
    "C#": { frets: [-1, 4, 3, 1, 2, 1], baseFret: 1 },
    "Db": { frets: [-1, 4, 3, 1, 2, 1], baseFret: 1 },
    "D#": { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
    "Eb": { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
    "F#": { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "Gb": { frets: [2, 4, 4, 3, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "G#": { frets: [4, 3, 1, 1, 1, 4], baseFret: 1 },
    "Ab": { frets: [4, 3, 1, 1, 1, 4], baseFret: 1 },
    "A#": { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    "Bb": { frets: [-1, 1, 3, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    "C#m": { frets: [-1, 4, 6, 6, 5, 4], barres: [{ fret: 4, from: 1, to: 5 }], baseFret: 4 },
    "F#m": { frets: [2, 4, 4, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 5 }] },
    "G#m": { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    "Bbm": { frets: [-1, 1, 3, 3, 2, 1], barres: [{ fret: 1, from: 1, to: 5 }] },
    "Ebm": { frets: [-1, -1, 1, 3, 4, 2], baseFret: 1 },
    "Abm": { frets: [4, 6, 6, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 5 }], baseFret: 4 },
    C7: { frets: [-1, 3, 2, 3, 1, 0] },
    D7: { frets: [-1, -1, 0, 2, 1, 2] },
    E7: { frets: [0, 2, 0, 1, 0, 0] },
    G7: { frets: [3, 2, 0, 0, 0, 1] },
    A7: { frets: [-1, 0, 2, 0, 2, 0] },
    B7: { frets: [-1, 2, 1, 2, 0, 2] },
  },
  cavaquinho: {
    // Cavaquinho tuning: D G B D (standard Brazilian)
    C:  { frets: [0, 0, 0, 2] },
    D:  { frets: [0, 2, 3, 2] },
    E:  { frets: [2, 1, 0, 2] },
    F:  { frets: [3, 2, 1, 0] },
    G:  { frets: [0, 0, 0, 0] },
    A:  { frets: [2, 2, 2, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    B:  { frets: [4, 4, 4, 4], barres: [{ fret: 4, from: 0, to: 3 }] },
    Am: { frets: [2, 2, 1, 2], barres: [{ fret: 2, from: 0, to: 3 }] },
    Bm: { frets: [4, 4, 3, 4], barres: [{ fret: 4, from: 0, to: 3 }], baseFret: 4 },
    Cm: { frets: [0, 0, 0, 1] },
    Dm: { frets: [0, 2, 3, 1] },
    Em: { frets: [2, 0, 0, 2] },
    Fm: { frets: [3, 1, 1, 0], barres: [{ fret: 1, from: 1, to: 2 }] },
    Gm: { frets: [0, 0, 0, 3] },
    C7: { frets: [0, 0, 0, 0] },
    D7: { frets: [0, 2, 1, 2] },
    E7: { frets: [2, 1, 0, 0] },
    G7: { frets: [0, 0, 0, 3] },
    A7: { frets: [2, 2, 2, 0] },
    B7: { frets: [4, 4, 4, 2], baseFret: 2 },
    "C#": { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    "Db": { frets: [1, 1, 1, 3], barres: [{ fret: 1, from: 0, to: 2 }] },
    "Bb": { frets: [3, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 3 }], baseFret: 3 },
    "F#": { frets: [4, 3, 2, 1] },
    "Gb": { frets: [4, 3, 2, 1] },
  },
  ukulele: {
    C:  { frets: [0, 0, 0, 3] },
    D:  { frets: [2, 2, 2, 0] },
    E:  { frets: [1, 4, 0, 2] },
    F:  { frets: [2, 0, 1, 0] },
    G:  { frets: [0, 2, 3, 2] },
    A:  { frets: [2, 1, 0, 0] },
    B:  { frets: [4, 3, 2, 2] },
    Am: { frets: [2, 0, 0, 0] },
    Dm: { frets: [2, 2, 1, 0] },
    Em: { frets: [0, 4, 3, 2] },
  },
};

function getStringsForInstrument(instrument: Instrument): number {
  if (instrument === "guitar") return 6;
  return 4;
}

export function getChordVoicing(chord: string, instrument: Instrument): ChordVoicing | null {
  if (instrument === "keyboard") return null;
  const db = CHORD_DB[instrument];
  if (!db) return null;
  // Try exact match, then root+quality
  return db[chord] || null;
}

export function drawChordDiagram(
  canvas: HTMLCanvasElement,
  chord: string,
  instrument: Instrument
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (instrument === "keyboard") {
    drawKeyboard(ctx, canvas, chord);
    return;
  }

  const voicing = getChordVoicing(chord, instrument);
  const numStrings = getStringsForInstrument(instrument);
  const numFrets = 5;
  const padding = { top: 50, bottom: 20, left: 30, right: 30 };
  const w = canvas.width;
  const h = canvas.height;
  const gridW = w - padding.left - padding.right;
  const gridH = h - padding.top - padding.bottom;
  const stringSpacing = gridW / (numStrings - 1);
  const fretSpacing = gridH / numFrets;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Title
  ctx.fillStyle = "hsl(220, 15%, 90%)";
  ctx.font = "bold 18px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(chord, w / 2, 24);

  // Nut
  ctx.strokeStyle = "hsl(220, 15%, 60%)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left + gridW, padding.top);
  ctx.stroke();

  // Frets
  ctx.lineWidth = 1;
  ctx.strokeStyle = "hsl(220, 15%, 30%)";
  for (let f = 1; f <= numFrets; f++) {
    const y = padding.top + f * fretSpacing;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + gridW, y);
    ctx.stroke();
  }

  // Strings
  for (let s = 0; s < numStrings; s++) {
    const x = padding.left + s * stringSpacing;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + gridH);
    ctx.stroke();
  }

  if (!voicing) {
    ctx.fillStyle = "hsl(220, 10%, 50%)";
    ctx.font = "14px 'Space Grotesk', sans-serif";
    ctx.fillText("Diagrama indisponível", w / 2, h / 2);
    return;
  }

  // Draw dots
  for (let s = 0; s < voicing.frets.length; s++) {
    const fret = voicing.frets[s];
    const x = padding.left + s * stringSpacing;

    if (fret === -1) {
      // Muted
      ctx.fillStyle = "hsl(0, 72%, 51%)";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("×", x, padding.top - 8);
    } else if (fret === 0) {
      // Open
      ctx.strokeStyle = "hsl(36, 95%, 55%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, padding.top - 12, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fretted
      const y = padding.top + (fret - 0.5) * fretSpacing;
      ctx.fillStyle = "hsl(36, 95%, 55%)";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Barres
  if (voicing.barres) {
    for (const barre of voicing.barres) {
      const y = padding.top + (barre.fret - 0.5) * fretSpacing;
      const x1 = padding.left + barre.from * stringSpacing;
      const x2 = padding.left + barre.to * stringSpacing;
      ctx.strokeStyle = "hsl(36, 95%, 55%)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
  }

  // Base fret indicator
  if (voicing.baseFret && voicing.baseFret > 1) {
    ctx.fillStyle = "hsl(220, 15%, 70%)";
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${voicing.baseFret}fr`, padding.left - 8, padding.top + fretSpacing * 0.5 + 4);
  }
}

function drawKeyboard(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, chord: string) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Title
  ctx.fillStyle = "hsl(220, 15%, 90%)";
  ctx.font = "bold 18px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(chord, w / 2, 24);

  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const blackKeys = [1, 3, 6, 8, 10]; // C# D# F# G# A#

  // Parse chord to get notes
  const chordNotes = getChordNotes(chord, NOTES);

  const keyW = 32;
  const keyH = 120;
  const blackKeyW = 20;
  const blackKeyH = 75;
  const startX = (w - 7 * keyW) / 2;
  const startY = 40;

  // White keys
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

  // Black keys
  const blackKeyPositions = [0, 1, 3, 4, 5]; // relative to white key index
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
    // Try flat notation
    const flatMap: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
    rootIdx = NOTES.indexOf(flatMap[root] || root);
  }
  if (rootIdx === -1) return [];

  // Intervals: major [0,4,7], minor [0,3,7], dim [0,3,6], aug [0,4,8]
  let intervals = [0, 4, 7];
  if (quality === "m" || quality === "min") intervals = [0, 3, 7];
  else if (quality === "dim") intervals = [0, 3, 6];
  else if (quality === "aug") intervals = [0, 4, 8];
  else if (quality === "sus") intervals = [0, 5, 7]; // sus4

  return intervals.map((i) => (rootIdx + i) % 12);
}
