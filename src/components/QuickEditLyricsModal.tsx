import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSong } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
  bodyText: string | null;
}

export default function QuickEditLyricsModal({ open, onOpenChange, songId, songTitle, bodyText }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(bodyText || "");

  useEffect(() => {
    if (open) setText(bodyText || "");
  }, [open, bodyText]);

  const mutation = useMutation({
    mutationFn: () => updateSong(songId, { body_text: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["song", songId] });
      toast.success("Cifra atualizada!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Cifra — {songTitle}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 min-h-[50vh] font-mono text-sm resize-none"
          placeholder="Cole ou edite a cifra/letra aqui..."
        />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
