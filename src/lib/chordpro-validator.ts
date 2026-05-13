/**
 * Validates whether a text content is in ChordPro format.
 * Must contain at least one chord in brackets (e.g. [C], [Am7], [G/B])
 * OR a recognizable section marker (Intro, Verso, Refrão, Ponte, Solo, etc.).
 */

// Matches inline ChordPro chord tokens like [C], [Am], [G7/B], [F#m7(9)]
const CHORD_RE = /\[[A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?\d{0,2}(?:\([^)]*\))?(?:\/[A-G][#b]?)?\]/;

// Matches common Portuguese/English section labels (line-anchored)
const SECTION_RE =
  /(^|\n)\s*(\[[^\]]+\]|(intro|introdução|verso|verse|pré[-\s]?refrão|pre[-\s]?chorus|refrão|refrao|chorus|ponte|bridge|solo|interlúdio|interludio|interlude|final|outro|coda|dedilhado|base)\s*[:\-])/i;

export interface ChordProValidationResult {
  valid: boolean;
  hasChords: boolean;
  hasSections: boolean;
  reason?: string;
}

export function validateChordPro(text: string | null | undefined): ChordProValidationResult {
  if (!text || !text.trim()) {
    return { valid: false, hasChords: false, hasSections: false, reason: "Conteúdo vazio." };
  }

  const hasChords = CHORD_RE.test(text);
  const hasSections = SECTION_RE.test(text);

  if (!hasChords && !hasSections) {
    return {
      valid: false,
      hasChords,
      hasSections,
      reason:
        "O conteúdo retornado não está em formato ChordPro (não foram encontrados acordes entre colchetes nem marcadores de seção). Revise antes de salvar.",
    };
  }

  if (!hasChords) {
    return {
      valid: false,
      hasChords,
      hasSections,
      reason:
        "O conteúdo possui seções mas nenhum acorde entre colchetes (ex.: [C], [Am]) foi detectado. Revise antes de salvar.",
    };
  }

  return { valid: true, hasChords, hasSections };
}
