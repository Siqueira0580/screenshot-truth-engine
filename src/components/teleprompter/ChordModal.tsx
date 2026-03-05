import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { drawChordDiagram, Instrument } from "@/lib/chord-diagrams";

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

export default function ChordModal({ chord, open, onClose }: ChordModalProps) {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !chord || !canvasRef.current) return;
    drawChordDiagram(canvasRef.current, chord, instrument);
  }, [open, chord, instrument]);

  if (!chord) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl text-primary">{chord}</DialogTitle>
        </DialogHeader>
        <Tabs value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
          <TabsList className="grid grid-cols-4 w-full">
            {INSTRUMENTS.map((i) => (
              <TabsTrigger key={i.value} value={i.value} className="text-xs">
                {i.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {INSTRUMENTS.map((i) => (
            <TabsContent key={i.value} value={i.value} className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={260}
                height={200}
                className="rounded-lg"
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
