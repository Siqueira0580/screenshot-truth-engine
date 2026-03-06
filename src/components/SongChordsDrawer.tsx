import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
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

function ChordCard({ chord }: { chord: string }) {
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawChordDiagram(canvasRef.current, chord, preferredInstrument);
  }, [chord, preferredInstrument]);

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-2">
      <span className="font-mono text-sm font-bold text-primary">{chord}</span>
      <canvas ref={canvasRef} width={160} height={190} className="rounded" />
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
        className="relative z-10 max-h-[75vh] flex flex-col rounded-t-2xl border-t border-border bg-background animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Acordes da Música</h3>
            <span className="text-xs text-muted-foreground">
              {chords.length} acordes · {INSTRUMENT_LABELS[preferredInstrument] || preferredInstrument}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto px-4 pb-6">
          {chords.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum acorde encontrado nesta música.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {chords.map((chord) => (
                <ChordCard key={chord} chord={chord} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
