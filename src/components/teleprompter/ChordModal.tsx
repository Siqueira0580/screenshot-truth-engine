import { useEffect, useRef, forwardRef } from "react";
import { drawChordDiagram } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useChordData } from "@/hooks/useChordData";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

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
  const { preferredInstrument } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { chordData, loading, source, simplified } = useChordData(
    open ? chord : null,
    preferredInstrument
  );

  useEffect(() => {
    if (!open || !chord || loading) return;

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
        setTimeout(() => draw(attempt + 1), 60 * (attempt + 1));
      }
    };

    setTimeout(() => draw(0), 80);
    return () => { cancelled = true; };
  }, [open, chord, preferredInstrument, chordData, loading, source, simplified]);

  if (!chord) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[200] grid w-full max-w-[240px] translate-x-[-50%] translate-y-[-50%] gap-3 border bg-background p-5 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <div className="flex flex-col items-center space-y-1">
            <DialogPrimitive.Title className="font-mono text-xl text-primary">{chord}</DialogPrimitive.Title>
            <span className="text-xs text-muted-foreground">{INSTRUMENT_LABELS[preferredInstrument] || preferredInstrument}</span>
          </div>
          <div className="flex justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center w-[200px] h-[240px] gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                <span className="text-xs text-muted-foreground">Calculando posição...</span>
              </div>
            ) : (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={200}
                  height={240}
                  className="rounded-lg"
                  style={{ display: 'block' }}
                />
                {source === "ai" && (
                  <span className="absolute bottom-1 right-1 text-[10px] text-muted-foreground/60">✨ IA</span>
                )}
              </div>
            )}
          </div>
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
