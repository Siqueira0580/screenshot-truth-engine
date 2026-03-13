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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createSong, updateSong, fetchSong, findOrCreateArtist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { FileUp, Loader2, Settings2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GuidedTour from "@/components/GuidedTour";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import type { Step } from "react-joyride";

const STUDIO_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "É aqui que a mágica acontece. Crie novas cifras ou edite as existentes com ferramentas profissionais.",
    title: "🎸 Bem-vindo ao Estúdio!",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "#tour-studio-title",
    content: "Você pode digitar o nome e o artista manualmente, mas temos um truque na manga...",
    title: "📝 Dados da Música",
    placement: "bottom",
  },
  {
    target: "#tour-studio-search",
    content: "Dica de Ouro: Pesquise a cifra por nome aqui. Nós preenchemos o título, o artista e a cifra automaticamente para você!",
    title: "🔍 Automação de Dados",
    placement: "bottom",
  },
  {
    target: "#tour-studio-cifra",
    content: "Cole ou digite a sua letra com os acordes aqui. O nosso sistema vai reconhecer os tons e formatar tudo lindamente para a leitura no palco.",
    title: "🎶 Sua Cifra",
    placement: "top",
  },
  {
    target: "#tour-studio-save",
    content: "Quando terminar, salve a música e ela já estará disponível na sua biblioteca e nos seus repertórios!",
    title: "✅ Tudo Pronto",
    placement: "top",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string | null;
}

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "12/8"];

export default function SongFormDialog({ open, onOpenChange, songId }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!songId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Guided tour for the studio form
  const { run: runStudioTour, completeTour: completeStudioTour, replayTour: replayStudioTour } = useGuidedTour("studio_form");
  const [tourReady, setTourReady] = useState(false);

  // Start tour after dialog animation settles (only for new songs, first time)
  useEffect(() => {
    if (open && !isEditing && runStudioTour) {
      const timer = setTimeout(() => setTourReady(true), 600);
      return () => clearTimeout(timer);
    } else {
      setTourReady(false);
    }
  }, [open, isEditing, runStudioTour]);

  // Expose replay function globally for the help button
  useEffect(() => {
    (window as any).__replayStudioTour = replayStudioTour;
    return () => { delete (window as any).__replayStudioTour; };
  }, [replayStudioTour]);

  const [form, setForm] = useState({
    title: "",
    artist: "",
    composer: "",
    musical_key: "",
    style: "",
    bpm: "",
    time_signature: "4/4",
    default_speed: "250",
    loop_count: "0",
    auto_next: true,
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
        time_signature: (song as any).time_signature || "4/4",
        default_speed: song.default_speed?.toString() || "250",
        loop_count: song.loop_count?.toString() || "0",
        auto_next: song.auto_next ?? true,
        youtube_url: song.youtube_url || "",
        body_text: song.body_text || "",
      });
    } else if (!isEditing && open) {
      setForm({
        title: "", artist: "", composer: "", musical_key: "", style: "",
        bpm: "", time_signature: "4/4", default_speed: "250", loop_count: "0",
        auto_next: true, youtube_url: "", body_text: "",
      });
    }
  }, [song, isEditing, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Auto-deduplicate artist
      if (form.artist.trim()) {
        await findOrCreateArtist(form.artist.trim());
      }

      const payload: any = {
        title: form.title,
        artist: form.artist || null,
        composer: form.composer || null,
        musical_key: form.musical_key || null,
        style: form.style || null,
        bpm: form.bpm ? parseInt(form.bpm) : null,
        time_signature: form.time_signature || "4/4",
        default_speed: form.default_speed ? parseInt(form.default_speed) : 250,
        loop_count: form.loop_count ? parseInt(form.loop_count) : 0,
        auto_next: form.auto_next,
        youtube_url: form.youtube_url || null,
        body_text: form.body_text || null,
      };
      return isEditing ? updateSong(songId!, payload) : createSong(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["artists"] });
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
      const { data, error } = await supabase.functions.invoke("parse-pdf", { body: formData });
      if (error) throw error;

      if (data) {
        // The AI returns structured data with all fields
        setForm((prev) => ({
          ...prev,
          title: data.title || prev.title,
          artist: data.artist || prev.artist,
          composer: data.composer || prev.composer,
          musical_key: data.musical_key || prev.musical_key,
          style: data.style || prev.style,
          bpm: data.bpm?.toString() || prev.bpm,
          time_signature: data.time_signature || prev.time_signature,
          body_text: data.body_text || data.text || prev.body_text,
        }));
        toast.success("PDF processado! Campos preenchidos automaticamente.");
      } else {
        toast.warning("Nenhum dado encontrado no PDF");
      }
    } catch (err) {
      console.error("PDF parse error:", err);
      toast.error("Erro ao processar o PDF");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearchCifra = async () => {
    if (!searchQuery.trim()) {
      toast.error("Digite o nome da música");
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-cifra", {
        body: { query: searchQuery.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        artist: data.artist || prev.artist,
        composer: data.composer || prev.composer,
        musical_key: data.musical_key || prev.musical_key,
        style: data.style || prev.style,
        bpm: data.bpm?.toString() || prev.bpm,
        time_signature: data.time_signature || prev.time_signature,
        body_text: data.body_text || prev.body_text,
      }));
      setSearchQuery("");
      toast.success("Cifra encontrada! Campos preenchidos automaticamente.");
    } catch (err) {
      console.error("Search cifra error:", err);
      toast.error("Erro ao buscar cifra");
    } finally {
      setIsSearching(false);
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
          {/* AI Search + PDF Import */}
          <div id="tour-studio-search" className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
            {/* AI Search */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar cifra por nome... Ex: Evidências - Chitãozinho e Xororó"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchCifra();
                  }
                }}
                className="flex-1"
                disabled={isSearching}
              />
              <Button
                type="button"
                variant="default"
                disabled={isSearching || !searchQuery.trim()}
                onClick={handleSearchCifra}
                className="gap-2 shrink-0"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Buscar Cifra
                  </>
                )}
              </Button>
            </div>
            {/* PDF Import */}
            <div className="flex items-center gap-3">
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
                className="gap-2"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando PDF...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Importar PDF
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Ou importe um PDF de cifra
              </p>
            </div>
          </div>

          {/* Metadados principais */}
          <div id="tour-studio-title" className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Fórmula de Compasso</Label>
              <Select value={form.time_signature} onValueChange={(v) => setForm({ ...form, time_signature: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SIGNATURES.map((ts) => (
                    <SelectItem key={ts} value={ts}>{ts}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* YouTube */}
          <div className="space-y-2">
            <Label>YouTube URL</Label>
            <Input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/..." />
          </div>

          {/* Configurações do Teleprompter */}
          <Accordion type="single" collapsible>
            <AccordionItem value="teleprompter" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Configurações do Teleprompter
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Velocidade Padrão</Label>
                    <Input
                      type="number"
                      value={form.default_speed}
                      onChange={(e) => setForm({ ...form, default_speed: e.target.value })}
                      placeholder="250"
                    />
                    <p className="text-xs text-muted-foreground">Pixels por segundo de rolagem</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Repetições (Loop)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.loop_count}
                      onChange={(e) => setForm({ ...form, loop_count: e.target.value })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">0 = sem repetição</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label>Auto-Next</Label>
                      <p className="text-xs text-muted-foreground">Avançar automaticamente para a próxima música</p>
                    </div>
                    <Switch
                      checked={form.auto_next}
                      onCheckedChange={(checked) => setForm({ ...form, auto_next: checked })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Cifra / Letra */}
          <div className="space-y-2">
            <Label>Cifra / Letra</Label>
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
