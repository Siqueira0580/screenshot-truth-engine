import { useState, useRef, useEffect, useCallback } from "react";
import { motion, PanInfo, useMotionValue } from "framer-motion";
import { GripHorizontal, Save, X, Undo2, Ruler } from "lucide-react";
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
        while (chordLine.length < t.col) chordLine += " ";
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
  const [showRuler, setShowRuler] = useState(true);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Measure monospace character width on mount
  useEffect(() => {
    const measure = () => {
      if (measureRef.current) {
        const rect = measureRef.current.getBoundingClientRect();
        const w = rect.width;
        if (w > 0) {
          setCharWidth(w / 20);
          setReady(true);
        }
      }
    };
    // Use rAF + fonts.ready for accurate measurement
    const raf = requestAnimationFrame(() => {
      measure();
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
          measure();
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSave = () => {
    const rebuilt = rebuildText(pairs);
    onSave(rebuilt);
    toast.success("Posições dos acordes atualizadas!");
  };

  const handleReset = () => {
    setPairs(parseTextToLinePairs(text));
  };

  const updateChordCol = useCallback(
    (pairIdx: number, tokenIdx: number, newCol: number) => {
      setPairs((prev) => {
        const next = [...prev];
        const chords = [...next[pairIdx].chords];
        chords[tokenIdx] = { ...chords[tokenIdx], col: newCol };
        next[pairIdx] = { ...next[pairIdx], chords };
        return next;
      });
    },
    []
  );

  const maxCols = 80;

  return (
    <div className="space-y-3">
      {/* Invisible char-width ruler */}
      <span
        ref={measureRef}
        className="font-mono text-sm whitespace-pre pointer-events-none"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -9999,
          left: -9999,
          visibility: "hidden",
        }}
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
          variant="outline"
          onClick={() => setShowRuler(!showRuler)}
          className="gap-1.5"
        >
          <Ruler className="h-4 w-4" /> {showRuler ? "Ocultar Régua" : "Mostrar Régua"}
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
        <div
          className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto"
          style={{ touchAction: "pan-y" }}
        >
          {/* Column ruler */}
          {showRuler && (
            <RulerBar charWidth={charWidth} maxCols={maxCols} />
          )}

          {pairs.map((pair, pairIdx) => (
            <PairRow
              key={pairIdx}
              pair={pair}
              pairIdx={pairIdx}
              charWidth={charWidth}
              maxCols={maxCols}
              showRuler={showRuler}
              onMoveChord={updateChordCol}
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

// ── Ruler Bar ────────────────────────────────────────────────────────

function RulerBar({ charWidth, maxCols }: { charWidth: number; maxCols: number }) {
  const ticks: number[] = [];
  for (let i = 0; i <= maxCols; i += 5) ticks.push(i);

  return (
    <div
      className="relative select-none mb-2 border-b border-border/50"
      style={{ height: 20, minWidth: maxCols * charWidth }}
    >
      {ticks.map((col) => (
        <span
          key={col}
          className="absolute top-0 text-muted-foreground font-mono"
          style={{
            left: col * charWidth,
            fontSize: 8,
            lineHeight: "12px",
          }}
        >
          {col % 10 === 0 ? (
            <>
              <span className="block" style={{ height: 8, width: 1, backgroundColor: "hsl(var(--muted-foreground))" }} />
              <span style={{ position: "relative", left: -3 }}>{col}</span>
            </>
          ) : (
            <span className="block" style={{ height: 4, width: 1, backgroundColor: "hsl(var(--border))" }} />
          )}
        </span>
      ))}
    </div>
  );
}

// ── Pair Row (chord line + lyric line) ───────────────────────────────

function PairRow({
  pair,
  pairIdx,
  charWidth,
  maxCols,
  showRuler,
  onMoveChord,
}: {
  pair: LinePair;
  pairIdx: number;
  charWidth: number;
  maxCols: number;
  showRuler: boolean;
  onMoveChord: (pairIdx: number, tokenIdx: number, newCol: number) => void;
}) {
  if (pair.standalone && pair.chords.length === 0) {
    return (
      <div className="font-mono text-sm text-foreground whitespace-pre-wrap leading-6 min-h-[1.5em]">
        {pair.lyric || "\u00A0"}
      </div>
    );
  }

  const lineLen = Math.max(pair.lyric.length, 60) + 20;

  return (
    <div className="mb-1">
      {/* Chord row — positioned container */}
      <div
        className="relative select-none"
        style={{
          height: 32,
          minWidth: lineLen * charWidth,
          touchAction: "none",
        }}
      >
        {pair.chords.map((token, tokenIdx) => (
          <DraggableChord
            key={`${pairIdx}-${tokenIdx}-${token.chord}`}
            token={token}
            charWidth={charWidth}
            maxCols={lineLen}
            onMove={(newCol) => onMoveChord(pairIdx, tokenIdx, newCol)}
          />
        ))}
      </div>

      {/* Lyric row */}
      <div
        className="font-mono text-sm text-foreground whitespace-pre leading-6"
        style={{ minWidth: lineLen * charWidth }}
      >
        {pair.lyric || "\u00A0"}
      </div>

      {/* Subtle separator */}
      <div
        className="h-px bg-border/30 mb-1"
        style={{ minWidth: lineLen * charWidth }}
      />
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
  const x = useMotionValue(0);
  const constraintRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const colDelta = Math.round(info.offset.x / charWidth);
      const newCol = Math.max(
        0,
        Math.min(maxCols - token.chord.length, token.col + colDelta)
      );
      // Reset motion value so position is controlled by state
      x.set(0);
      if (newCol !== token.col) {
        onMove(newCol);
      }
    },
    [charWidth, maxCols, token.chord.length, token.col, onMove, x]
  );

  return (
    <div
      ref={constraintRef}
      className="absolute top-0"
      style={{
        left: 0,
        right: 0,
        height: 32,
      }}
    >
      <motion.div
        drag="x"
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintRef}
        onDragEnd={handleDragEnd}
        style={{
          x,
          position: "absolute",
          left: token.col * charWidth,
          top: 2,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        whileDrag={{ scale: 1.12, zIndex: 50 }}
        whileHover={{ scale: 1.05 }}
        className="font-mono text-sm font-bold text-primary bg-primary/10 border-2 border-primary/40 rounded px-1 py-1 leading-5 cursor-grab active:cursor-grabbing active:bg-primary/25 active:border-primary/60 whitespace-nowrap z-10"
      >
        <GripHorizontal className="inline h-3 w-3 mr-0.5 opacity-50" />
        {token.chord}
      </motion.div>
    </div>
  );
}
