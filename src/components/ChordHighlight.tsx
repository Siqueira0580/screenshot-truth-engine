import { useRef, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { drawChordDiagram } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface ChordHighlightProps {
  chord: string;
}

/**
 * Interactive chord highlight — click/tap to see the chord diagram
 * in a popover. Reads the preferred instrument from global context.
 * The displayed text always shows the original chord name (e.g. D7M),
 * while the diagram renderer translates internally (D7M → Dmaj7).
 */
export default function ChordHighlight({ chord }: ChordHighlightProps) {
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const draw = (attempt = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.getContext("2d")) {
        drawChordDiagram(canvas, chord, preferredInstrument);
      } else if (attempt < 5) {
        setTimeout(() => draw(attempt + 1), 50 * (attempt + 1));
      }
    };
    setTimeout(() => draw(0), 50);
    return () => { cancelled = true; };
  }, [isOpen, chord, preferredInstrument]);

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
        <canvas ref={canvasRef} width={160} height={220} className="rounded block" />
      </PopoverContent>
    </Popover>
  );
}
