import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSong, updateSong, fetchSong } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string | null;
}

export default function SongFormDialog({ open, onOpenChange, songId }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!songId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const [form, setForm] = useState({
    title: "",
    artist: "",
    composer: "",
    musical_key: "",
    style: "",
    bpm: "",
    youtube_url: "",
    body_text: "",
  });

  const { data: song } = useQuery({
    queryKey: ["song", songId],
    queryFn: () => fetchSong(songId!),
    enabled: !!songId && open,
  });

  useEffect(() => {
    if (song && isEditing) {
      setForm({
        title: song.title,
        artist: song.artist || "",
        composer: song.composer || "",
        musical_key: song.musical_key || "",
        style: song.style || "",
        bpm: song.bpm?.toString() || "",
        youtube_url: song.youtube_url || "",
        body_text: song.body_text || "",
      });
    } else if (!isEditing && open) {
      setForm({ title: "", artist: "", composer: "", musical_key: "", style: "", bpm: "", youtube_url: "", body_text: "" });
    }
  }, [song, isEditing, open]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        artist: form.artist || null,
        composer: form.composer || null,
        musical_key: form.musical_key || null,
        style: form.style || null,
        bpm: form.bpm ? parseInt(form.bpm) : null,
        youtube_url: form.youtube_url || null,
        body_text: form.body_text || null,
      };
      return isEditing ? updateSong(songId!, payload) : createSong(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      if (isEditing) queryClient.invalidateQueries({ queryKey: ["song", songId] });
      toast.success(isEditing ? "Música atualizada!" : "Música criada!");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar música"),
  });

  const handlePdfUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("parse-pdf", {
        body: formData,
      });

      if (error) throw error;

      if (data?.text) {
        setForm((prev) => ({ ...prev, body_text: data.text }));
        toast.success("Cifra extraída do PDF!");
      } else {
        toast.warning("Nenhum texto encontrado no PDF");
      }
    } catch (err) {
      console.error("PDF parse error:", err);
      toast.error("Erro ao processar o PDF");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Música" : "Nova Música"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return toast.error("Título é obrigatório");
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Artista</Label>
              <Input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Compositor</Label>
              <Input value={form.composer} onChange={(e) => setForm({ ...form, composer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tom</Label>
              <Input value={form.musical_key} onChange={(e) => setForm({ ...form, musical_key: e.target.value })} placeholder="Ex: C, Am, G#m" />
            </div>
            <div className="space-y-2">
              <Label>Estilo</Label>
              <Input value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} placeholder="Ex: Samba, Rock, MPB" />
            </div>
            <div className="space-y-2">
              <Label>BPM</Label>
              <Input type="number" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>YouTube URL</Label>
            <Input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/..." />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cifra / Letra</Label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isParsing}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 text-xs"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Extraindo...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-3 w-3" />
                      Importar PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              value={form.body_text}
              onChange={(e) => setForm({ ...form, body_text: e.target.value })}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Cole aqui a cifra ou letra da música..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
