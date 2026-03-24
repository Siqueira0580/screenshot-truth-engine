import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { GripHorizontal, Save, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  /** Single lines that aren't part of a chord/lyric pair */
  standalone?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const CHORD_LINE_RE = /^[\s]*([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?(?:\s+|$))+$/;

const CHORD_TOKEN_RE = /([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?)/g;

function isChordLine(line: string): boolean {
  if (!line.trim()) return false;
  return CHORD_LINE_RE.test(line);
}

function extractChordTokens(line: string): ChordToken[] {
  const tokens: ChordToken[] = [];
  let match: RegExpExecArray | null;
  CHORD_TOKEN_RE.lastIndex = 0;
  while ((match = CHORD_TOKEN_RE.exec(line)) !== null) {
    tokens.push({
      id: `${match.index}-${match[0]}`,
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
  while (i < rawLines.length) {
    if (isChordLine(rawLines[i])) {
      const chords = extractChordTokens(rawLines[i]);
      const lyric = i + 1 < rawLines.length && !isChordLine(rawLines[i + 1])
        ? rawLines[i + 1]
        : "";
      pairs.push({ chords, lyric });
      i += lyric ? 2 : 1;
    } else {
      // Standalone lyric / empty line
      pairs.push({ chords: [], lyric: rawLines[i], standalone: true });
      i++;
    }
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
    // Build chord line from tokens
    if (pair.chords.length > 0) {
      const sorted = [...pair.chords].sort((a, b) => a.col - b.col);
      let chordLine = "";
      for (const t of sorted) {
        while (chordLine.length < t.col) chordLine += " ";
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

export default function VisualChordEditor({ text, onSave, onCancel }: VisualChordEditorProps) {
  const [pairs, setPairs] = useState<LinePair[]>(() => parseTextToLinePairs(text));
  const [charWidth, setCharWidth] = useState(9);
  const measureRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure monospace char width
  useEffect(() => {
    if (measureRef.current) {
      const rect = measureRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setCharWidth(rect.width / 10); // We render 10 chars
      }
    }
  }, []);

  const handleSave = () => {
    onSave(rebuildText(pairs));
  };

  const handleReset = () => {
    setPairs(parseTextToLinePairs(text));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="h-4 w-4" /> Salvar Posições
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
          <Undo2 className="h-4 w-4" /> Resetar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1.5">
          <X className="h-4 w-4" /> Fechar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <GripHorizontal className="h-3 w-3" /> Arraste os acordes para reposicionar
        </span>
      </div>

      {/* Hidden char-width measurer */}
      <span
        ref={measureRef}
        className="font-mono text-sm absolute opacity-0 pointer-events-none whitespace-pre"
        aria-hidden="true"
      >
        {"MMMMMMMMMM"}
      </span>

      {/* Editor area */}
      <div
        ref={containerRef}
        className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto select-none"
      >
        {pairs.map((pair, pairIdx) => (
          <PairRow
            key={pairIdx}
            pair={pair}
            pairIdx={pairIdx}
            charWidth={charWidth}
            onUpdateChords={(chords) => {
              setPairs((prev) => {
                const next = [...prev];
                next[pairIdx] = { ...next[pairIdx], chords };
                return next;
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Pair Row ─────────────────────────────────────────────────────────

function PairRow({
  pair,
  pairIdx,
  charWidth,
  onUpdateChords,
}: {
  pair: LinePair;
  pairIdx: number;
  charWidth: number;
  onUpdateChords: (chords: ChordToken[]) => void;
}) {
  if (pair.standalone && pair.chords.length === 0) {
    return (
      <div className="font-mono text-sm text-foreground whitespace-pre-wrap min-h-[1.5em]">
        {pair.lyric || "\u00A0"}
      </div>
    );
  }

  return (
    <div className="relative mb-1">
      {/* Chord row */}
      <div className="relative h-7 w-full" style={{ minWidth: `${(pair.lyric.length + 20) * charWidth}px` }}>
        {pair.chords.map((token, tokenIdx) => (
          <DraggableChord
            key={token.id}
            token={token}
            charWidth={charWidth}
            maxCols={Math.max(pair.lyric.length + 20, 80)}
            onMove={(newCol) => {
              const updated = [...pair.chords];
              updated[tokenIdx] = { ...token, col: newCol };
              onUpdateChords(updated);
            }}
          />
        ))}
      </div>
      {/* Lyric row */}
      <div className="font-mono text-sm text-foreground whitespace-pre-wrap">
        {pair.lyric || "\u00A0"}
      </div>
    </div>
  );
}

// ── Draggable Chord ──────────────────────────────────────────────────

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
  const ref = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startCol = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
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
      const colDelta = Math.round(dx / charWidth);
      const newCol = Math.max(0, Math.min(maxCols, startCol.current + colDelta));
      if (newCol !== token.col) {
        onMove(newCol);
      }
    },
    [charWidth, maxCols, token.col, onMove]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <span
      ref={ref}
      className="absolute top-0 font-mono text-sm font-bold text-primary bg-primary/10 border border-primary/30 rounded px-1 cursor-grab active:cursor-grabbing select-none z-10 transition-none touch-none"
      style={{
        left: `${token.col * charWidth}px`,
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
