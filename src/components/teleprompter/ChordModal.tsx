import { useEffect, useRef, useState, forwardRef } from "react";
import { drawChordDiagram, Instrument } from "@/lib/chord-diagrams";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

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
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        drawChordDiagram(canvasRef.current, chord, instrument);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, chord, instrument]);

  if (!chord) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[200] grid w-full max-w-xs translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogPrimitive.Title className="font-mono text-xl text-primary">{chord}</DialogPrimitive.Title>
          </div>
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
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
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
