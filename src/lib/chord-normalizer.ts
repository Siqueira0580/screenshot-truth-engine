/**
 * Brazilian Chord Notation → International Notation Translator
 * 
 * Translates BR-specific chord symbols BEFORE passing to the SVG renderer.
 * The original display text is never modified — translation is internal only.
 * 
 * Examples:
 *   D7M     → Dmaj7
 *   Fº      → Fdim
 *   F°      → Fdim
 *   C7+     → Caug7  (augmented)
 *   Am7+    → Am(maj7) — but simplified to Am for lookup
 *   G+      → Gaug
 *   A7(9-)  → A7b9   (but simplified to A7 for lookup)
 *   E7(#9)  → E7#9   (but simplified to E7 for lookup)
 *   Bb7(9/13) → Bb7  (simplified — tensions stripped)
 */

/**
 * Translate a Brazilian chord name to international notation
 * that our internal chord database understands.
 */
export function translateChordBR(chord: string): string {
  let c = chord.trim();

  // 1. Normalize unicode
  c = c.replace(/♯/g, "#").replace(/♭/g, "b");

  // 2. Extract root
  const rootMatch = c.match(/^([A-G][#b]?)(.*)/);
  if (!rootMatch) return c;

  const [, root, rest] = rootMatch;
  let suffix = rest;

  // 3. Degree symbol → dim (must come before other replacements)
  //    Cº7 → Cdim7, Fº → Fdim
  suffix = suffix.replace(/[º°]/g, "dim");

  // 4. Brazilian "7M" → "maj7" (D7M → Dmaj7)
  //    Must match 7M but NOT 7m (which is already minor 7)
  //    Also handle 9M, etc.
  suffix = suffix.replace(/(\d)M\b/g, (_, digit) => `maj${digit}`);
  // Handle when 7M is at end: "7M" → "maj7"
  suffix = suffix.replace(/^(m?)7M/g, "$1maj7");
  // Standalone "7M" pattern
  suffix = suffix.replace(/7M$/g, "maj7");
  suffix = suffix.replace(/7M(?=[(/])/g, "maj7");

  // 4b. Brazilian "m7M" → "mMaj7" (Minor Major 7)
  suffix = suffix.replace(/^m7M$/g, "mMaj7");
  suffix = suffix.replace(/^m7M(?=[(/])/g, "mMaj7");

  // 4c. Brazilian shorthand: "C4" → "Csus4", "C2" → "Csus2"
  if (/^4$/.test(suffix)) suffix = "sus4";
  if (/^2$/.test(suffix)) suffix = "sus2";
  // "7(4)" → "7sus4"
  suffix = suffix.replace(/^7\(4\)$/, "7sus4");

  // 4d. "6(9)" → "69" (6/9 chord)
  suffix = suffix.replace(/6\(9\)/, "69");

  // 4e. Parenthetical tensions → flat notation: "7(9b)" → "7b9", "7(9#)" → "7#9"
  suffix = suffix.replace(/\((\d+)([b#])\)/g, (_, deg, acc) => acc + deg);
  // "7(b9)" style already handled by stripping in lookup chain

  // 4f. "m7(5b)" → "m7b5" (half-diminished)
  suffix = suffix.replace(/\(5b\)/, "b5");
  suffix = suffix.replace(/\(b5\)/, "b5");

  // 5. "+" as augmented when it's a quality modifier
  //    C+ → Caug, C+7 → Caug (simplified)
  //    But NOT m7+ (which in BR means m(maj7) — edge case)
  if (/^\+/.test(suffix)) {
    suffix = suffix.replace(/^\+/, "aug");
  }

  // 6. Strip parenthetical tensions for lookup simplification
  //    These are captured by regex but our DB doesn't have them
  //    A7(9-) → A7, Bb7(9/13) → Bb7, C7(b5) → C7
  //    We keep the base chord for diagram lookup
  // (This is handled by resolveChordVoicing fallback, but we can pre-strip here too)

  // 7. Normalize "min" → "m"
  suffix = suffix.replace(/min(?!or)/g, "m");

  // 8. Normalize "maj" to our DB format (we store both maj7 and M7)
  // Keep as-is since our DB has both Cmaj7 and CM7

  return root + suffix;
}

/**
 * Build a list of fallback chord names to try, from most specific to least.
 * Uses BR translation + progressive simplification.
 */
export function getChordLookupChain(chord: string): { name: string; simplified: boolean }[] {
  const translated = translateChordBR(chord);
  const chain: { name: string; simplified: boolean }[] = [];

  // 1. Exact translated match
  chain.push({ name: translated, simplified: false });

  // 2. If different from original normalized form, add that too
  const normalized = chord.replace(/♯/g, "#").replace(/♭/g, "b");
  if (normalized !== translated) {
    chain.push({ name: normalized, simplified: false });
  }

  // 3. Strip parenthetical content
  const noParens = translated.replace(/\([^)]*\)/g, "");
  if (noParens !== translated) {
    chain.push({ name: noParens, simplified: true });
  }

  // 4. Strip slash bass
  const noSlash = noParens.replace(/\/[A-G][#b]?$/, "");
  if (noSlash !== noParens) {
    chain.push({ name: noSlash, simplified: true });
  }

  // 5. Strip numeric tensions (b5, #9, 9, 11, 13, b13, etc.) but keep base quality
  const rootMatch = noSlash.match(/^([A-G][#b]?)(m|dim|aug|maj)?(.*)$/);
  if (rootMatch) {
    const [, root, quality = "", tensions] = rootMatch;
    
    // Try removing just the highest tension
    const base7 = tensions.match(/^(7|maj7)/)?.[0];
    if (base7 && tensions !== base7) {
      chain.push({ name: root + quality + base7, simplified: true });
    }

    // Try just quality (e.g., Am, Cdim)
    if (quality) {
      chain.push({ name: root + quality, simplified: true });
    }

    // Try just root
    chain.push({ name: root, simplified: true });
  }

  // Deduplicate
  const seen = new Set<string>();
  return chain.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}
