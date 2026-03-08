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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Music2, Check, X, ArrowLeft, Mic } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { createSongAndAddToLibrary, addToUserLibrary, findOrCreateArtist, addSongToSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImportSongModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistId?: string;
  setlistPosition?: number;
}

type Step = "search" | "preview";

interface PreviewData {
  title: string;
  artist: string | null;
  genre?: string | null;
  style?: string | null;
  content?: string | null;
  body_text?: string | null;
  musical_key?: string | null;
  bpm?: number | null;
  composer?: string | null;
  time_signature?: string | null;
  source_url?: string | null;
  artist_image_url?: string | null;
  youtube_url?: string | null;
}

export default function ImportSongModal({
  open,
  onOpenChange,
  setlistId,
  setlistPosition,
}: ImportSongModalProps) {
  const [input, setInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<Step>("search");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const queryClient = useQueryClient();

  const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

  const validateUrl = (text: string): boolean => {
    if (!isUrl(text)) {
      toast.error("Por favor, cole um link válido de um site de cifras (ex: https://cifraclub.com.br/...)");
      return false;
    }
    return true;
  };

  const resetToSearch = () => {
    setStep("search");
    setPreviewData(null);
  };

  const handleClose = () => {
    setInput("");
    resetToSearch();
    onOpenChange(false);
  };

  const handleSearch = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error("Cole o link da cifra");
      return;
    }

    if (!validateUrl(trimmed)) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-song-url", {
        body: { url: trimmed },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setPreviewData(data);
      setStep("preview");
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erro ao importar a cifra. Verifique o link e tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setIsSaving(true);
    try {
      const title = previewData.title || "Sem título";
      const artist = previewData.artist || null;
      const style = previewData.genre || previewData.style || null;
      const bodyText = previewData.content || previewData.body_text || null;

      if (artist) {
        try {
          await findOrCreateArtist(artist, previewData.artist_image_url || undefined);
        } catch { /* non-critical */ }
      }

      // Check for duplicate: same title + artist already in global songs
      let songId: string | null = null;
      if (artist) {
        const { data: existing } = await supabase
          .from("songs")
          .select("id")
          .ilike("title", title)
          .ilike("artist", artist)
          .limit(1);
        if (existing && existing.length > 0) {
          songId = existing[0].id;
        }
      }

      if (songId) {
        // Song already exists globally — just add to user's library
        await addToUserLibrary(songId);
        if (setlistId) {
          await addSongToSetlist(setlistId, songId, setlistPosition ?? 999);
          queryClient.invalidateQueries({ queryKey: ["setlist-items", setlistId] });
        }
        toast.success(`"${title}" já existia — adicionada à sua biblioteca!`);
      } else {
        // Create new song + add to library
        const newSong = await createSongAndAddToLibrary({
          title,
          artist,
          style,
          body_text: bodyText,
          musical_key: previewData.musical_key || null,
          bpm: previewData.bpm || null,
          composer: previewData.composer || null,
          time_signature: previewData.time_signature || null,
          youtube_url: previewData.youtube_url || null,
        });

        if (setlistId && newSong?.id) {
          await addSongToSetlist(setlistId, newSong.id, setlistPosition ?? 999);
          queryClient.invalidateQueries({ queryKey: ["setlist-items", setlistId] });
        }
        toast.success(`"${title}" importada com sucesso!`);
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["user-library"] });
      queryClient.invalidateQueries({ queryKey: ["artist-songs"] });
      handleClose();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar a música. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const bodyText = previewData?.content || previewData?.body_text || "";
  const snippetLines = bodyText.split("\n").slice(0, 8).join("\n");

  const loadingText = "O robô está a ler o site e a afinar os acordes...";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === "search" ? "Importar Cifra via Link" : "Pré-visualização"}
          </DialogTitle>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cole o link da cifra</Label>
              <Input
                type="url"
                placeholder="https://cifraclub.com.br/artista/musica"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
                }}
                disabled={isSearching}
              />
              <p className="text-xs text-muted-foreground">
                Funciona com Cifra Club, Letras.mus.br, Ultimate Guitar e outros sites de cifras.
              </p>
            </div>

            {isSearching && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6">
                <div className="relative">
                  <Music2 className="h-8 w-8 text-primary animate-bounce" />
                  <Loader2 className="absolute -right-2 -top-2 h-4 w-4 animate-spin text-primary" />
                </div>
                <p className="text-sm text-center text-muted-foreground">{loadingText}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isSearching}>
                Cancelar
              </Button>
              <Button onClick={handleSearch} disabled={isSearching || !input.trim() || !isUrl(input.trim())} className="gap-2">
                {isSearching ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Importar Cifra</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="space-y-4">
            {/* Metadata with artist image */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 shrink-0 shadow-md">
                {previewData.artist_image_url ? (
                  <AvatarImage src={previewData.artist_image_url} alt={previewData.artist || "Artista"} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <Mic className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground leading-tight">{previewData.title}</h3>
                {previewData.artist && (
                  <p className="text-sm text-muted-foreground">{previewData.artist}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                {(previewData.genre || previewData.style) && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {previewData.genre || previewData.style}
                  </span>
                )}
                {previewData.musical_key && (
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    Tom: {previewData.musical_key}
                  </span>
                )}
                {previewData.bpm && (
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    {previewData.bpm} BPM
                  </span>
                )}
                {previewData.composer && (
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    ✍ {previewData.composer}
                  </span>
                )}
                </div>
              </div>
            </div>

            {/* Snippet preview */}
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Primeiras linhas da cifra:</p>
              <ScrollArea className="max-h-40">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                  {snippetLines || "(sem conteúdo)"}
                </pre>
              </ScrollArea>
            </div>

            {previewData.source_url && (
              <p className="text-xs text-muted-foreground truncate">
                Fonte: <a href={previewData.source_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">{previewData.source_url}</a>
              </p>
            )}

            {/* Action buttons */}
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={resetToSearch}
                disabled={isSaving}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Buscar outra
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  <><Check className="h-4 w-4" />Sim, Importar Música</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
