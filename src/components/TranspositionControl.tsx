import { useState } from "react";
import { RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Order matches Cifra Club layout: 6 cols × 2 rows
const KEY_GRID = ["A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab"];
// Chromatic reference for semitone math (uses flats — matches KEY_GRID labels)
const CHROMA = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function rootIndex(root: string): number {
  const norm = root
    .replace("C#", "Db")
    .replace("D#", "Eb")
    .replace("Gb", "F#")
    .replace("G#", "Ab")
    .replace("A#", "Bb");
  return CHROMA.indexOf(norm);
}

interface Props {
  originalKey?: string | null;
  transpose: number;
  setTranspose: (n: number | ((prev: number) => number)) => void;
  /** Force grid open by default */
  defaultOpen?: boolean;
  className?: string;
  compact?: boolean;
}

export default function TranspositionControl({
  originalKey,
  transpose,
  setTranspose,
  defaultOpen = false,
  className,
  compact,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const origMatch = originalKey?.match(/^([A-G][#b]?)(.*)/);
  const origRoot = origMatch?.[1];
  const suffix = origMatch?.[2] ?? "";
  const origIdx = origRoot ? rootIndex(origRoot) : -1;

  const currentSemitone =
    origIdx >= 0 ? ((origIdx + transpose) % 12 + 12) % 12 : -1;

  return (
    <div className={cn("rounded-xl bg-muted/40 p-2 sm:p-3 w-full", className)}>
      {/* Top row: undo + -1/2 tom + +1/2 tom + toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTranspose(0)}
          disabled={transpose === 0}
          className={cn("shrink-0 rounded-lg bg-muted/60 hover:bg-muted", compact ? "h-9 w-9" : "h-10 w-10")}
          aria-label="Tom original"
          title="Tom original"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          onClick={() => setTranspose((t) => t - 1)}
          className={cn(
            "flex-1 rounded-lg bg-muted/60 hover:bg-muted font-semibold text-foreground",
            compact ? "h-9 text-xs" : "h-10 text-sm"
          )}
        >
          - 1/2 tom
        </Button>

        <Button
          variant="ghost"
          onClick={() => setTranspose((t) => t + 1)}
          className={cn(
            "flex-1 rounded-lg bg-muted/60 hover:bg-muted font-semibold text-foreground",
            compact ? "h-9 text-xs" : "h-10 text-sm"
          )}
        >
          + 1/2 tom
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((o) => !o)}
          className={cn("shrink-0 rounded-lg hover:bg-muted", compact ? "h-9 w-9" : "h-10 w-10")}
          aria-label={open ? "Recolher notas" : "Mostrar todas as notas"}
        >
          <ChevronDown
            className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>

      {/* Key grid */}
      {open && (
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mt-2 sm:mt-3">
          {KEY_GRID.map((key) => {
            const targetIdx = CHROMA.indexOf(key);
            const isActive = currentSemitone === targetIdx;
            const disabled = origIdx < 0;
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => {
                  const semis = ((targetIdx - origIdx) % 12 + 12) % 12;
                  // Choose shortest signed delta in [-6, 6) for nicer chord transposition
                  const signed = semis > 6 ? semis - 12 : semis;
                  setTranspose(signed);
                }}
                className={cn(
                  "rounded-lg font-bold font-mono transition-colors",
                  compact ? "h-9 text-xs" : "h-10 sm:h-11 text-sm",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground",
                  disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      )}

      {!originalKey && open && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Sem tom definido para esta música
        </p>
      )}
    </div>
  );
}
