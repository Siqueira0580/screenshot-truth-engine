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
import { Sparkles, Loader2, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSong, findOrCreateArtist, addSongToSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImportSongModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistId?: string;
  setlistPosition?: number;
}

export default function ImportSongModal({
  open,
  onOpenChange,
  setlistId,
  setlistPosition,
}: ImportSongModalProps) {
  const [input, setInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

  const handleImport = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error("Digite o nome da música ou cole um link");
      return;
    }

    setIsImporting(true);
    try {
      let data: { title: string; artist: string; genre?: string; content?: string; body_text?: string; style?: string; error?: string };

      if (isUrl(trimmed)) {
        // Route A: Web scraping via import-song-url
        const { data: urlData, error } = await supabase.functions.invoke("import-song-url", {
          body: { url: trimmed },
        });
        if (error) throw error;
        if (urlData?.error) { toast.error(urlData.error); return; }
        data = urlData;
      } else {
        // Route B: AI generation via search-cifra
        const { data: aiData, error } = await supabase.functions.invoke("search-cifra", {
          body: { query: trimmed },
        });
        if (error) throw error;
        if (aiData?.error) { toast.error(aiData.error); return; }
        data = aiData;
      }

      // Normalize fields (search-cifra returns body_text/style, import-song-url returns content/genre)
      const title = data.title || "Sem título";
      const artist = data.artist || null;
      const style = data.genre || data.style || null;
      const bodyText = data.content || data.body_text || null;

      // Auto-deduplicate artist
      if (artist) {
        try { await findOrCreateArtist(artist); } catch { /* non-critical */ }
      }

      const newSong = await createSong({
        title,
        artist,
        style,
        body_text: bodyText,
        musical_key: (data as any).musical_key || null,
        bpm: (data as any).bpm || null,
        composer: (data as any).composer || null,
        time_signature: (data as any).time_signature || null,
      });

      if (setlistId && newSong?.id) {
        await addSongToSetlist(setlistId, newSong.id, setlistPosition ?? 999);
        queryClient.invalidateQueries({ queryKey: ["setlist-items", setlistId] });
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success(`"${title}" importada com sucesso!`);
      setInput("");
      onOpenChange(false);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erro ao importar/gerar a cifra. Tente novamente.");
    } finally {
      setIsImporting(false);
    }
  };

  const loadingText = isUrl(input.trim())
    ? "O robô está a ler o site e a afinar os acordes..."
    : "A IA está a compor a cifra com o seu conhecimento musical...";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar / Gerar Cifra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cole o link da cifra ou digite o Nome da Música e Artista</Label>
            <Input
              placeholder="https://cifraclub.com.br/... ou Evidências Chitãozinho"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleImport(); }
              }}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              Funciona com links (Cifra Club, Letras.mus.br, Ultimate Guitar) ou buscas por nome.
            </p>
          </div>

          {isImporting && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6">
              <div className="relative">
                <Music2 className="h-8 w-8 text-primary animate-bounce" />
                <Loader2 className="absolute -right-2 -top-2 h-4 w-4 animate-spin text-primary" />
              </div>
              <p className="text-sm text-center text-muted-foreground">{loadingText}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={isImporting || !input.trim()} className="gap-2">
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
              ) : (
                <><Sparkles className="h-4 w-4" />Importar / Gerar</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
