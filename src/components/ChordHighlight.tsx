import { useRef, useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { drawChordDiagram } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface ChordHighlightProps {
  chord: string;
}

export default function ChordHighlight({ chord }: ChordHighlightProps) {
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        drawChordDiagram(canvasRef.current, chord, preferredInstrument);
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [isOpen, chord, preferredInstrument]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <span className="text-primary font-bold cursor-pointer hover:text-accent transition-colors duration-150 underline decoration-primary/30 underline-offset-2">
            {chord}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-auto p-2 bg-popover border-border shadow-xl rounded-lg overflow-hidden"
        >
          <canvas ref={canvasRef} width={220} height={180} className="rounded block" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
