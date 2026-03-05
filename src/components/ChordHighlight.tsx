import { useRef, useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { drawChordDiagram, Instrument } from "@/lib/chord-diagrams";
import { cn } from "@/lib/utils";

interface ChordHighlightProps {
  chord: string;
  instrument?: Instrument;
}

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "guitar", label: "Violão" },
  { value: "cavaquinho", label: "Cavaco" },
  { value: "ukulele", label: "Uke" },
  { value: "keyboard", label: "Tecl." },
];

export default function ChordHighlight({ chord, instrument: defaultInstrument = "guitar" }: ChordHighlightProps) {
  const [instrument, setInstrument] = useState<Instrument>(defaultInstrument);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        drawChordDiagram(canvasRef.current, chord, instrument);
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [isOpen, chord, instrument]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <span
            className="text-primary font-bold cursor-pointer hover:text-accent transition-colors duration-150 underline decoration-primary/30 underline-offset-2"
          >
            {chord}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-auto p-0 bg-popover border-border shadow-xl rounded-lg overflow-hidden"
        >
          <div className="p-2 space-y-2">
            {/* Instrument selector */}
            <div className="flex gap-1">
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInstrument(i.value);
                  }}
                  className={cn(
                    "text-[10px] py-0.5 px-1.5 rounded transition-colors",
                    instrument === i.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {i.label}
                </button>
              ))}
            </div>
            {/* Chord diagram canvas */}
            <canvas
              ref={canvasRef}
              width={220}
              height={180}
              className="rounded block"
            />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
