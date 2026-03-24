import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo } from "framer-motion";
import { GripHorizontal, Save, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VisualChordEditorProps {
  text: string;
  onSave: (updatedText: string) => void;
  onCancel: () => void;
}

interface ChordToken {
  id: string;
  chord: string;
  /** Column position (0-based, in character units) */
  col: number;
}

interface LinePair {
  chords: ChordToken[];
  lyric: string;
  standalone?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const CHORD_LINE_RE =
  /^[\s]*([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?(?:\s+|$))+$/;

const CHORD_TOKEN_RE =
  /([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?)/g;

function isChordLine(line: string): boolean {
  if (!line.trim()) return false;
  return CHORD_LINE_RE.test(line);
}

function extractChordTokens(line: string, pairIdx: number): ChordToken[] {
  const tokens: ChordToken[] = [];
  let match: RegExpExecArray | null;
  CHORD_TOKEN_RE.lastIndex = 0;
  while ((match = CHORD_TOKEN_RE.exec(line)) !== null) {
    tokens.push({
      id: `p${pairIdx}-c${match.index}-${match[0]}`,
      chord: match[0],
      col: match.index,
    });
  }
  return tokens;
}

function parseTextToLinePairs(text: string): LinePair[] {
  const rawLines = text.split("\n");
  const pairs: LinePair[] = [];
  let i = 0;
  let pairIdx = 0;
  while (i < rawLines.length) {
    if (isChordLine(rawLines[i])) {
      const chords = extractChordTokens(rawLines[i], pairIdx);
      const nextIsLyric =
        i + 1 < rawLines.length && !isChordLine(rawLines[i + 1]);
      const lyric = nextIsLyric ? rawLines[i + 1] : "";
      pairs.push({ chords, lyric });
      i += nextIsLyric ? 2 : 1;
    } else {
      pairs.push({ chords: [], lyric: rawLines[i], standalone: true });
      i++;
    }
    pairIdx++;
  }
  return pairs;
}

function rebuildText(pairs: LinePair[]): string {
  const lines: string[] = [];
  for (const pair of pairs) {
    if (pair.standalone && pair.chords.length === 0) {
      lines.push(pair.lyric);
      continue;
    }
    if (pair.chords.length > 0) {
      const sorted = [...pair.chords].sort((a, b) => a.col - b.col);
      let chordLine = "";
      for (const t of sorted) {
        // Pad with spaces up to target column
        while (chordLine.length < t.col) chordLine += " ";
        // If we already passed the col (overlapping chords), add a space
        if (chordLine.length > t.col) chordLine += " ";
        chordLine += t.chord;
      }
      lines.push(chordLine);
    }
    if (pair.lyric || !pair.standalone) {
      lines.push(pair.lyric);
    }
  }
  return lines.join("\n");
}

// ── Main Component ───────────────────────────────────────────────────

export default function VisualChordEditor({
  text,
  onSave,
  onCancel,
}: VisualChordEditorProps) {
  const [pairs, setPairs] = useState<LinePair[]>(() =>
    parseTextToLinePairs(text)
  );
  const [charWidth, setCharWidth] = useState<number>(0);
  const [ready, setReady] = useState(false);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Measure monospace character width on mount
  useEffect(() => {
    const measure = () => {
      if (measureRef.current) {
        const w = measureRef.current.getBoundingClientRect().width;
        if (w > 0) {
          setCharWidth(w / 20); // 20 identical chars
          setReady(true);
        }
      }
    };
    // Measure after paint
    requestAnimationFrame(() => {
      measure();
      // Fallback: try again after fonts load
      if (document.fonts?.ready) {
        document.fonts.ready.then(measure);
      }
    });
  }, []);

  const handleSave = () => {
    const rebuilt = rebuildText(pairs);
    onSave(rebuilt);
    toast.success("Posições dos acordes atualizadas!");
  };

  const handleReset = () => {
    setPairs(parseTextToLinePairs(text));
  };

  const updateChords = useCallback(
    (pairIdx: number, chords: ChordToken[]) => {
      setPairs((prev) => {
        const next = [...prev];
        next[pairIdx] = { ...next[pairIdx], chords };
        return next;
      });
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Invisible char-width ruler — MUST be in normal flow to measure correctly */}
      <span
        ref={measureRef}
        className="font-mono text-sm block h-0 overflow-hidden whitespace-pre pointer-events-none"
        aria-hidden="true"
      >
        {"XXXXXXXXXXXXXXXXXXXX"}
      </span>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="h-4 w-4" /> Salvar Posições
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="gap-1.5"
        >
          <Undo2 className="h-4 w-4" /> Resetar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="gap-1.5"
        >
          <X className="h-4 w-4" /> Fechar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <GripHorizontal className="h-3 w-3" /> Arraste os acordes
        </span>
      </div>

      {/* Editor canvas */}
      {ready && charWidth > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto">
          {pairs.map((pair, pairIdx) => (
            <PairRow
              key={pairIdx}
              pair={pair}
              charWidth={charWidth}
              onUpdateChords={(chords) => updateChords(pairIdx, chords)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-muted-foreground text-sm">
          Carregando editor visual…
        </div>
      )}
    </div>
  );
}

// ── Pair Row (chord line + lyric line) ───────────────────────────────

function PairRow({
  pair,
  charWidth,
  onUpdateChords,
}: {
  pair: LinePair;
  charWidth: number;
  onUpdateChords: (chords: ChordToken[]) => void;
}) {
  // Standalone text line (no chords above)
  if (pair.standalone && pair.chords.length === 0) {
    return (
      <div className="font-mono text-sm text-foreground whitespace-pre-wrap leading-6 min-h-[1.5em]">
        {pair.lyric || "\u00A0"}
      </div>
    );
  }

  const maxLen = Math.max(pair.lyric.length, 60) + 20;

  return (
    <div className="mb-0.5">
      {/* Chord row — positioned container */}
      <div
        className="relative select-none"
        style={{
          height: 28,
          minWidth: maxLen * charWidth,
        }}
      >
        {pair.chords.map((token, tokenIdx) => (
          <DraggableChord
            key={token.id}
            token={token}
            charWidth={charWidth}
            maxCols={maxLen}
            onMove={(newCol) => {
              const updated = [...pair.chords];
              updated[tokenIdx] = { ...token, col: newCol };
              onUpdateChords(updated);
            }}
          />
        ))}
      </div>

      {/* Lyric row — character grid reference */}
      <div
        className="font-mono text-sm text-foreground whitespace-pre leading-6"
        style={{ minWidth: maxLen * charWidth }}
      >
        {pair.lyric || "\u00A0"}
      </div>

      {/* Char ruler (subtle dots every 10 chars) */}
      <div
        className="relative h-px mb-1"
        style={{ minWidth: maxLen * charWidth }}
      >
        {Array.from({ length: Math.floor(maxLen / 10) }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 w-px h-1 bg-border"
            style={{ left: (i + 1) * 10 * charWidth }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Draggable Chord Token ────────────────────────────────────────────

function DraggableChord({
  token,
  charWidth,
  maxCols,
  onMove,
}: {
  token: ChordToken;
  charWidth: number;
  maxCols: number;
  onMove: (newCol: number) => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startCol = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      startX.current = e.clientX;
      startCol.current = token.col;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [token.col]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      // Snap: round to nearest character column
      const colDelta = Math.round(dx / charWidth);
      const newCol = Math.max(
        0,
        Math.min(maxCols - token.chord.length, startCol.current + colDelta)
      );
      if (newCol !== token.col) {
        onMove(newCol);
      }
    },
    [charWidth, maxCols, token.col, token.chord.length, onMove]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <span
      className="absolute top-0 font-mono text-sm font-bold text-primary bg-primary/10 border border-primary/30 rounded-sm px-0.5 py-0.5 leading-5 cursor-grab active:cursor-grabbing active:bg-primary/20 active:border-primary/50 select-none z-10 touch-none whitespace-nowrap"
      style={{
        left: token.col * charWidth,
        transition: dragging.current ? "none" : "left 0.1s ease-out",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {token.chord}
    </span>
  );
}
