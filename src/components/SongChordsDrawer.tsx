import { useRef, useEffect } from "react";
import { X } from "lucide-react";

import { drawChordDiagram } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

const INSTRUMENT_LABELS: Record<string, string> = {
  guitar: "Violão",
  cavaquinho: "Cavaquinho",
  ukulele: "Ukulele",
  keyboard: "Teclado",
};

interface SongChordsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chords: string[];
}

function ChordCard({ chord, visible }: { chord: string; visible: boolean }) {
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
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
    setTimeout(() => draw(0), 30);
    return () => { cancelled = true; };
  }, [chord, preferredInstrument, visible]);

  return (
    <div className="group flex flex-col items-center gap-0.5 rounded-lg border border-border/50 bg-card/80 p-1.5 transition-all duration-200 hover:border-primary/40 hover:bg-card active:scale-[0.97]">
      <span className="font-sans text-[11px] font-semibold tracking-wide text-primary">{chord}</span>
      <canvas ref={canvasRef} width={100} height={120} className="rounded block" />
    </div>
  );
}

export default function SongChordsDrawer({ isOpen, onClose, chords }: SongChordsDrawerProps) {
  const { preferredInstrument } = useUserPreferences();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end" onClick={onClose}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="relative z-10 max-h-[70vh] flex flex-col rounded-t-2xl border-t border-border bg-background animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">Acordes da Música</h3>
            <span className="text-[10px] text-muted-foreground">
              {chords.length} acordes · {INSTRUMENT_LABELS[preferredInstrument] || preferredInstrument}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto px-3 pb-4">
          {chords.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              Nenhum acorde encontrado nesta música.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {[...chords].sort((a, b) => a.localeCompare(b)).map((chord) => (
                <ChordCard key={chord} chord={chord} visible={isOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
