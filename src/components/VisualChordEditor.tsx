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
  col: number;
}

interface LinePair {
  chords: ChordToken[];
  lyric: string;
  standalone?: boolean;
  /** Whether this pair was parsed from ChordPro inline format */
  chordpro?: boolean;
}

// ── Detection ────────────────────────────────────────────────────────

const CHORDPRO_RE = /\[([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?)\]/g;

const CHORD_LINE_RE =
  /^[\s]*([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?(?:\s+|$))+$/;

const CHORD_TOKEN_RE =
  /([A-G][#b♯♭]?(?:m(?:aj|in)?|M|maj|min|dim|aug|sus[24]?|add|[º°])?(?:\d{0,2}[M+]?)?(?:(?:[#b♯♭]\d{1,2}|sus[24]?|add\d{1,2}|no\d{1,2}|aug|dim|\+)*)(?:\((?:[#b♯♭+\-]?\d{1,2}[,\/\s]*)+\))?(?:\/[A-G][#b♯♭]?)?)/g;

function hasChordProBrackets(line: string): boolean {
  CHORDPRO_RE.lastIndex = 0;
  return CHORDPRO_RE.test(line);
}

function isChordLine(line: string): boolean {
  if (!line.trim()) return false;
  return CHORD_LINE_RE.test(line);
}

// ── ChordPro parser ─────────────────────────────────────────────────

function parseChordProLine(line: string, pairIdx: number): LinePair {
  const chords: ChordToken[] = [];
  let cleanText = "";
  let lastEnd = 0;
  let chordIdx = 0;

  CHORDPRO_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHORDPRO_RE.exec(line)) !== null) {
    // Add text before bracket to cleanText
    cleanText += line.slice(lastEnd, match.index);
    const col = cleanText.length;
    chords.push({
      id: `p${pairIdx}-cp${chordIdx}-${match[1]}`,
      chord: match[1],
      col,
    });
    chordIdx++;
    lastEnd = match.index + match[0].length;
  }
  cleanText += line.slice(lastEnd);

  return { chords, lyric: cleanText, chordpro: true };
}

// ── Traditional parser (chord line + lyric line) ─────────────────────

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

// ── Master parser ────────────────────────────────────────────────────

function parseTextToLinePairs(text: string): LinePair[] {
  const rawLines = text.split("\n");
  const pairs: LinePair[] = [];
  let i = 0;
  let pairIdx = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // 1) ChordPro inline format: [Am]Texto [G]mais texto
    if (hasChordProBrackets(line)) {
      pairs.push(parseChordProLine(line, pairIdx));
      i++;
    }
    // 2) Traditional: separate chord line above lyric line
    else if (isChordLine(line)) {
      const chords = extractChordTokens(line, pairIdx);
      const nextIsLyric =
        i + 1 < rawLines.length && !isChordLine(rawLines[i + 1]) && !hasChordProBrackets(rawLines[i + 1]);
      const lyric = nextIsLyric ? rawLines[i + 1] : "";
      pairs.push({ chords, lyric });
      i += nextIsLyric ? 2 : 1;
    }
    // 3) Plain text line
    else {
      pairs.push({ chords: [], lyric: line, standalone: true });
      i++;
    }
    pairIdx++;
  }
  return pairs;
}

// ── Rebuild ──────────────────────────────────────────────────────────

function rebuildText(pairs: LinePair[]): string {
  const lines: string[] = [];

  for (const pair of pairs) {
    // Standalone text
    if (pair.standalone && pair.chords.length === 0) {
      lines.push(pair.lyric);
      continue;
    }

    // ChordPro format — rebuild as [Chord]lyric inline
    if (pair.chordpro) {
      const sorted = [...pair.chords].sort((a, b) => a.col - b.col);
      let result = "";
      let cursor = 0;
      for (const t of sorted) {
        const insertAt = Math.max(cursor, t.col);
        // Pad with spaces if chord moved past current text length
        while (result.length < insertAt) {
          if (cursor < pair.lyric.length) {
            result += pair.lyric[cursor];
            cursor++;
          } else {
            result += " ";
            cursor++;
          }
        }
        result += `[${t.chord}]`;
      }
      // Append remaining lyric text
      if (cursor < pair.lyric.length) {
        result += pair.lyric.slice(cursor);
      }
      lines.push(result);
      continue;
    }

    // Traditional format — chord line + lyric line
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

  useEffect(() => {
    const measure = () => {
      if (measureRef.current) {
        const w = measureRef.current.getBoundingClientRect().width;
        if (w > 0) {
          setCharWidth(w / 20);
          setReady(true);
        }
      }
    };
    const raf = requestAnimationFrame(() => {
      measure();
      if (document.fonts?.ready) {
        document.fonts.ready.then(measure);
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

  const transferChord = useCallback(
    (sourcePairIdx: number, tokenIdx: number, targetPairIdx: number, newCol: number) => {
      setPairs((prev) => {
        const next = [...prev];
        // Remove from source
        const sourceChords = [...next[sourcePairIdx].chords];
        const [movedChord] = sourceChords.splice(tokenIdx, 1);
        next[sourcePairIdx] = { ...next[sourcePairIdx], chords: sourceChords };
        // Add to target
        const targetChords = [...next[targetPairIdx].chords];
        targetChords.push({ ...movedChord, col: newCol, id: `p${targetPairIdx}-moved-${Date.now()}` });
        next[targetPairIdx] = { ...next[targetPairIdx], chords: targetChords, standalone: false };
        return next;
      });
    },
    []
  );

  const maxCols = 80;

  return (
    <div className="space-y-3">
      <span
        ref={measureRef}
        className="font-mono text-sm whitespace-pre pointer-events-none"
        aria-hidden="true"
        style={{ position: "absolute", top: -9999, left: -9999, visibility: "hidden" }}
      >
        {"XXXXXXXXXXXXXXXXXXXX"}
      </span>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="h-4 w-4" /> Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
          <Undo2 className="h-4 w-4" /> Resetar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowRuler(!showRuler)} className="gap-1.5">
          <Ruler className="h-4 w-4" /> {showRuler ? "Ocultar Régua" : "Régua"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="gap-1.5">
          <X className="h-4 w-4" /> Fechar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <GripHorizontal className="h-3 w-3" /> Arraste os acordes
        </span>
      </div>

      {/* Canvas */}
      {ready && charWidth > 0 ? (
        <div
          className="rounded-lg border border-border bg-muted/30 p-4 overflow-x-auto"
          style={{ touchAction: "pan-y" }}
        >
          {showRuler && <RulerBar charWidth={charWidth} maxCols={maxCols} />}

          {pairs.map((pair, pairIdx) => (
            <PairRow
              key={pairIdx}
              pair={pair}
              pairIdx={pairIdx}
              charWidth={charWidth}
              maxCols={maxCols}
              onMoveChord={updateChordCol}
              onTransferChord={transferChord}
              totalPairs={pairs.length}
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

// ── Ruler ────────────────────────────────────────────────────────────

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
          style={{ left: col * charWidth, fontSize: 8, lineHeight: "12px" }}
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

// ── Pair Row ─────────────────────────────────────────────────────────

function PairRow({
  pair,
  pairIdx,
  charWidth,
  maxCols,
  onMoveChord,
}: {
  pair: LinePair;
  pairIdx: number;
  charWidth: number;
  maxCols: number;
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
      {/* Chord row */}
      <div
        className="relative select-none"
        style={{ height: 32, minWidth: lineLen * charWidth, touchAction: "none" }}
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

      {/* Lyric row (clean text, no brackets) */}
      <div
        className="font-mono text-sm text-foreground whitespace-pre leading-6"
        style={{ minWidth: lineLen * charWidth }}
      >
        {pair.lyric || "\u00A0"}
      </div>

      <div className="h-px bg-border/30 mb-1" style={{ minWidth: lineLen * charWidth }} />
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
  const x = useMotionValue(0);
  const constraintRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const colDelta = Math.round(info.offset.x / charWidth);
      const newCol = Math.max(0, Math.min(maxCols - token.chord.length, token.col + colDelta));
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
      style={{ left: 0, right: 0, height: 32 }}
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
