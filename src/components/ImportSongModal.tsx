import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSong, findOrCreateArtist, addSongToSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImportSongModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the imported song will be linked to this setlist */
  setlistId?: string;
  /** Position to insert at within the setlist */
  setlistPosition?: number;
}

export default function ImportSongModal({
  open,
  onOpenChange,
  setlistId,
  setlistPosition,
}: ImportSongModalProps) {
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Cole um link válido");
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-song-url", {
        body: { url: trimmed },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Auto-deduplicate artist
      if (data.artist) {
        try {
          await findOrCreateArtist(data.artist);
        } catch {
          // non-critical
        }
      }

      // Save song
      const newSong = await createSong({
        title: data.title || "Sem título",
        artist: data.artist || null,
        style: data.genre || null,
        body_text: data.content || null,
      });

      // Link to setlist if inside a setlist context
      if (setlistId && newSong?.id) {
        await addSongToSetlist(setlistId, newSong.id, setlistPosition ?? 999);
        queryClient.invalidateQueries({ queryKey: ["setlist-items", setlistId] });
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success(`"${data.title}" importada com sucesso!`);
      setUrl("");
      onOpenChange(false);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erro ao importar a cifra. Verifique o link e tente novamente.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Importar via Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cole o link da cifra aqui</Label>
            <Input
              placeholder="https://www.cifraclub.com.br/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleImport();
                }
              }}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              Funciona com Cifra Club, Letras.mus.br, Ultimate Guitar e outros sites de cifra.
            </p>
          </div>

          {isImporting && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6">
              <div className="relative">
                <Music2 className="h-8 w-8 text-primary animate-bounce" />
                <Loader2 className="absolute -right-2 -top-2 h-4 w-4 animate-spin text-primary" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                O robô está a ler o site e a afinar os acordes...
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !url.trim()}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Importar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
