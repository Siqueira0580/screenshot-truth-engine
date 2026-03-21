import { useRef, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { drawChordDiagram, resolveAllVoicings } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useChordData } from "@/hooks/useChordData";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";

interface ChordHighlightProps {
  chord: string;
}

export default function ChordHighlight({ chord }: ChordHighlightProps) {
  const { preferredInstrument, chordPreferences, saveChordPreference } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { chordData, loading, source, simplified } = useChordData(
    isOpen ? chord : null,
    preferredInstrument
  );

  // Multi-voicing state
  const allVoicings = isOpen ? resolveAllVoicings(chord, preferredInstrument) : [];
  const totalVoicings = allVoicings.length;
  const prefKey = `${chord}::${preferredInstrument}`;
  const savedIndex = chordPreferences[prefKey] ?? 0;
  const [voicingIndex, setVoicingIndex] = useState(0);

  // Reset index when chord opens
  useEffect(() => {
    if (isOpen) {
      setVoicingIndex(Math.min(savedIndex, Math.max(totalVoicings - 1, 0)));
    }
  }, [isOpen, savedIndex, totalVoicings]);

  useEffect(() => {
    if (!isOpen || loading) return;
    let cancelled = false;
    const draw = (attempt = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.getContext("2d")) {
        // Use voicing from allVoicings if available, otherwise fall back to AI data
        if (totalVoicings > 0 && voicingIndex < totalVoicings) {
          const voicing = allVoicings[voicingIndex];
          drawChordDiagram(canvas, chord, preferredInstrument, voicing, false);
        } else {
          const preResolved = chordData && (source === "cache" || source === "ai") ? chordData : undefined;
          drawChordDiagram(canvas, chord, preferredInstrument, preResolved, simplified);
        }
      } else if (attempt < 5) {
        setTimeout(() => draw(attempt + 1), 50 * (attempt + 1));
      }
    };
    setTimeout(() => draw(0), 50);
    return () => { cancelled = true; };
  }, [isOpen, chord, preferredInstrument, chordData, loading, source, simplified, voicingIndex, totalVoicings]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVoicingIndex((i) => (i > 0 ? i - 1 : totalVoicings - 1));
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVoicingIndex((i) => (i < totalVoicings - 1 ? i + 1 : 0));
  };
  const handleSaveDefault = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await saveChordPreference(prefKey, voicingIndex);
    toast.success("Formato salvo como padrão!");
  };

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
          <div className="flex flex-col items-center justify-center w-[110px] h-[120px] gap-1.5">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
            <span className="text-[10px] text-muted-foreground">Carregando...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <canvas ref={canvasRef} width={110} height={120} className="rounded block" />
              {source === "ai" && totalVoicings === 0 && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px] text-muted-foreground/50">✨</span>
              )}
            </div>
            {totalVoicings > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={handlePrev} className="p-0.5 rounded hover:bg-muted transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <span className="text-[9px] text-muted-foreground tabular-nums min-w-[36px] text-center">
                  {voicingIndex + 1} de {totalVoicings}
                </span>
                <button onClick={handleNext} className="p-0.5 rounded hover:bg-muted transition-colors">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={handleSaveDefault}
                  className={`p-0.5 rounded hover:bg-muted transition-colors ${voicingIndex === savedIndex ? "text-primary" : "text-muted-foreground"}`}
                  title="Definir como padrão"
                >
                  <Star className={`h-3 w-3 ${voicingIndex === savedIndex ? "fill-primary" : ""}`} />
                </button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
