import { useEffect, useRef, useState, forwardRef } from "react";
import { drawChordDiagram, resolveAllVoicings } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useChordData } from "@/hooks/useChordData";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";

const INSTRUMENT_LABELS: Record<string, string> = {
  guitar: "Violão",
  cavaquinho: "Cavaquinho",
  ukulele: "Ukulele",
  keyboard: "Teclado",
};

interface ChordModalProps {
  chord: string | null;
  open: boolean;
  onClose: () => void;
}

const ChordModal = forwardRef<HTMLDivElement, ChordModalProps>(({ chord, open, onClose }, _ref) => {
  const { preferredInstrument, chordPreferences, saveChordPreference } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { chordData, loading, source, simplified } = useChordData(
    open ? chord : null,
    preferredInstrument
  );

  const allVoicings = open && chord ? resolveAllVoicings(chord, preferredInstrument) : [];
  const totalVoicings = allVoicings.length;
  const prefKey = chord ? `${chord}::${preferredInstrument}` : "";
  const savedIndex = chordPreferences[prefKey] ?? 0;
  const [voicingIndex, setVoicingIndex] = useState(0);

  useEffect(() => {
    if (open && chord) {
      setVoicingIndex(Math.min(savedIndex, Math.max(totalVoicings - 1, 0)));
    }
  }, [open, chord, savedIndex, totalVoicings]);

  useEffect(() => {
    if (!open || !chord || loading) return;
    let cancelled = false;
    const draw = (attempt = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.getContext("2d")) {
        if (totalVoicings > 0 && voicingIndex < totalVoicings) {
          drawChordDiagram(canvas, chord, preferredInstrument, allVoicings[voicingIndex], false);
        } else {
          const preResolved = chordData && (source === "cache" || source === "ai") ? chordData : undefined;
          drawChordDiagram(canvas, chord, preferredInstrument, preResolved, simplified);
        }
      } else if (attempt < 5) {
        setTimeout(() => draw(attempt + 1), 60 * (attempt + 1));
      }
    };
    setTimeout(() => draw(0), 80);
    return () => { cancelled = true; };
  }, [open, chord, preferredInstrument, chordData, loading, source, simplified, voicingIndex, totalVoicings]);

  if (!chord) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[200] grid w-full max-w-[220px] translate-x-[-50%] translate-y-[-50%] gap-2 border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <div className="flex flex-col items-center space-y-1">
            <DialogPrimitive.Title className="font-mono text-xl text-primary">{chord}</DialogPrimitive.Title>
            <span className="text-xs text-muted-foreground">{INSTRUMENT_LABELS[preferredInstrument] || preferredInstrument}</span>
          </div>
          <div className="flex justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center w-[140px] h-[150px] gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                <span className="text-[10px] text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <div className="relative">
                <canvas ref={canvasRef} width={140} height={150} className="rounded-lg" style={{ display: 'block' }} />
                {source === "ai" && totalVoicings === 0 && (
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] text-muted-foreground/50">✨</span>
                )}
              </div>
            )}
          </div>
          {totalVoicings > 1 && !loading && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setVoicingIndex((i) => (i > 0 ? i - 1 : totalVoicings - 1))} className="p-1 rounded hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {voicingIndex + 1} de {totalVoicings}
              </span>
              <button onClick={() => setVoicingIndex((i) => (i < totalVoicings - 1 ? i + 1 : 0))} className="p-1 rounded hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={async () => {
                  await saveChordPreference(prefKey, voicingIndex);
                  toast.success("Formato salvo!");
                }}
                className={`p-1 rounded hover:bg-muted transition-colors ${voicingIndex === savedIndex ? "text-primary" : "text-muted-foreground"}`}
                title="Definir como padrão"
              >
                <Star className={`h-3.5 w-3.5 ${voicingIndex === savedIndex ? "fill-primary" : ""}`} />
              </button>
            </div>
          )}
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

ChordModal.displayName = "ChordModal";

export default ChordModal;
