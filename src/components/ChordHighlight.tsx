import { useRef, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { drawChordDiagram } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useChordData } from "@/hooks/useChordData";

interface ChordHighlightProps {
  chord: string;
}

export default function ChordHighlight({ chord }: ChordHighlightProps) {
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { chordData, loading, source, simplified } = useChordData(
    isOpen ? chord : null,
    preferredInstrument
  );

  useEffect(() => {
    if (!isOpen || loading) return;
    let cancelled = false;
    const draw = (attempt = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.getContext("2d")) {
        const preResolved = chordData && (source === "cache" || source === "ai")
          ? chordData
          : undefined;
        drawChordDiagram(canvas, chord, preferredInstrument, preResolved, simplified);
      } else if (attempt < 5) {
        setTimeout(() => draw(attempt + 1), 50 * (attempt + 1));
      }
    };
    setTimeout(() => draw(0), 50);
    return () => { cancelled = true; };
  }, [isOpen, chord, preferredInstrument, chordData, loading, source, simplified]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          className="text-primary font-bold cursor-pointer hover:text-accent transition-colors duration-150 underline decoration-primary/30 underline-offset-2"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          {chord}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-auto p-2 bg-popover border-border shadow-xl rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center w-[160px] h-[220px] gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Calculando posição...</span>
          </div>
        ) : (
          <div className="relative">
            <canvas ref={canvasRef} width={160} height={220} className="rounded block" />
            {source === "ai" && (
              <span className="absolute bottom-1 right-1 text-[9px] text-muted-foreground/60">✨ IA</span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
