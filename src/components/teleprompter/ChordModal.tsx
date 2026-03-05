import { useEffect, useRef, useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { drawChordDiagram, Instrument } from "@/lib/chord-diagrams";
import { cn } from "@/lib/utils";

interface ChordModalProps {
  chord: string | null;
  open: boolean;
  onClose: () => void;
}

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "guitar", label: "Violão" },
  { value: "cavaquinho", label: "Cavaquinho" },
  { value: "ukulele", label: "Ukulele" },
  { value: "keyboard", label: "Teclado" },
];

const ChordModal = forwardRef<HTMLDivElement, ChordModalProps>(({ chord, open, onClose }, _ref) => {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !chord || !canvasRef.current) return;
    // Small delay to ensure canvas is mounted
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        drawChordDiagram(canvasRef.current, chord, instrument);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, chord, instrument]);

  if (!chord) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl text-primary">{chord}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 w-full">
          {INSTRUMENTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setInstrument(i.value)}
              className={cn(
                "flex-1 text-xs py-1.5 px-2 rounded-md transition-colors",
                instrument === i.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={260}
            height={200}
            className="rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
});

ChordModal.displayName = "ChordModal";

export default ChordModal;
