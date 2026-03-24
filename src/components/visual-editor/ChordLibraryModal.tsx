import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const COMMON_CHORDS = [
  "C", "D", "E", "F", "G", "A", "B",
  "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm",
  "C7", "D7", "E7", "G7", "A7", "B7",
  "F#m", "C#m", "G#m", "Bb", "Eb", "Ab",
];

interface ChordLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertChord: (chordName: string) => void;
}

export default function ChordLibraryModal({
  open,
  onOpenChange,
  onInsertChord,
}: ChordLibraryModalProps) {
  const [customChord, setCustomChord] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingChord, setPendingChord] = useState("");
  const { user } = useAuth();

  const handleCommonChordClick = (chord: string) => {
    onInsertChord(chord);
    onOpenChange(false);
  };

  const handleCustomInsert = () => {
    const trimmed = customChord.trim();
    if (!trimmed) return;
    setPendingChord(trimmed);
    setSaveDialogOpen(true);
  };

  const insertAndClose = (chord: string) => {
    onInsertChord(chord);
    setCustomChord("");
    onOpenChange(false);
  };

  const handleSaveToLibrary = async () => {
    if (!user) {
      toast.error("Faça login para salvar acordes.");
      insertAndClose(pendingChord);
      return;
    }
    try {
      await supabase.from("custom_chords").insert({
        chord_name: pendingChord,
        user_id: user.id,
        instrument: "guitar",
      });
      toast.success(`"${pendingChord}" salvo na sua biblioteca!`);
    } catch {
      toast.error("Erro ao salvar na biblioteca.");
    }
    setSaveDialogOpen(false);
    insertAndClose(pendingChord);
  };

  const handleSkipSave = () => {
    setSaveDialogOpen(false);
    insertAndClose(pendingChord);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Biblioteca de Acordes
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-7 gap-1.5">
            {COMMON_CHORDS.map((chord) => (
              <Button
                key={chord}
                variant="outline"
                size="sm"
                className="h-9 px-1 font-mono text-xs font-bold hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                onClick={() => handleCommonChordClick(chord)}
              >
                {chord}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              value={customChord}
              onChange={(e) => setCustomChord(e.target.value)}
              placeholder="Outro acorde..."
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCustomInsert()}
            />
            <Button size="sm" onClick={handleCustomInsert} disabled={!customChord.trim()} className="gap-1 shrink-0">
              <Plus className="h-4 w-4" /> Inserir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar na biblioteca?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja salvar <strong className="text-foreground">"{pendingChord}"</strong> na sua biblioteca global de acordes para uso futuro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipSave}>Não, apenas inserir</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveToLibrary}>Sim, salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
