import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";

const STYLES = ["Samba", "Rock", "MPB", "Pop", "Gospel", "Sertanejo", "Forró", "Jazz", "Blues", "Reggae"];
const OCCASIONS = ["Festa", "Churrasco", "Show", "Casamento", "Barzinho", "Aniversário", "Culto", "Evento Corporativo"];
const DURATION_OPTIONS = [
  { value: "3600", label: "1 hora" },
  { value: "5400", label: "1h30" },
  { value: "7200", label: "2 horas" },
  { value: "10800", label: "3 horas" },
];

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (setlistId: string) => void;
}

export default function AutoSetlistGeneratorModal({ open, onOpenChange, onCreated }: Props) {
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [occasion, setOccasion] = useState("");
  const [sizeMode, setSizeMode] = useState<"duration" | "quantity">("quantity");
  const [duration, setDuration] = useState("7200");
  const [quantity, setQuantity] = useState(20);
  const [source, setSource] = useState<"all" | "setlists">("all");
  const [loading, setLoading] = useState(false);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!occasion) {
      toast.error("Selecione uma ocasião");
      return;
    }

    setLoading(true);
    try {
      let songs: any[] | null = null;

      if (source === "setlists") {
        // Fetch unique song IDs from all existing setlists
        const { data: items, error: itemsErr } = await supabase
          .from("setlist_items")
          .select("song_id, setlist_id, setlists!inner(user_id)");
        if (itemsErr) throw itemsErr;

        const uniqueSongIds = [...new Set((items || []).map((i: any) => i.song_id))];
        if (uniqueSongIds.length === 0) {
          toast.error("Nenhuma música encontrada nos seus repertórios existentes");
          setLoading(false);
          return;
        }

        // Fetch those songs, applying style filter if needed
        let query = supabase.from("songs").select("*").in("id", uniqueSongIds);
        if (selectedStyles.size > 0) {
          const styleFilters = Array.from(selectedStyles).map((s) => `style.ilike.%${s}%`).join(",");
          query = query.or(styleFilters);
        }
        const { data, error } = await query;
        if (error) throw error;
        songs = data;
      } else {
        // Fetch all songs, optionally filtering by style
        let query = supabase.from("songs").select("*");
        if (selectedStyles.size > 0) {
          const styleFilters = Array.from(selectedStyles).map((s) => `style.ilike.%${s}%`).join(",");
          query = query.or(styleFilters);
        }
        const { data, error } = await query;
        if (error) throw error;
        songs = data;
      }

      if (!songs || songs.length === 0) {
        toast.error("Nenhuma música encontrada no acervo com esses filtros");
        setLoading(false);
        return;
      }

      const shuffled = fisherYatesShuffle(songs);
      let selected: typeof songs;

      if (sizeMode === "quantity") {
        selected = shuffled.slice(0, Math.min(quantity, shuffled.length));
      } else {
        const targetSeconds = parseInt(duration);
        const FALLBACK_DURATION = 210; // 3m30s
        selected = [];
        let totalSeconds = 0;
        for (const song of shuffled) {
          const songDuration = FALLBACK_DURATION;
          if (totalSeconds + songDuration > targetSeconds) break;
          selected.push(song);
          totalSeconds += songDuration;
        }
      }

      if (selected.length === 0) {
        toast.error("Não foi possível gerar um repertório com esses critérios");
        setLoading(false);
        return;
      }

      // Build name
      const sizeLabel = sizeMode === "quantity"
        ? `${selected.length} Músicas`
        : DURATION_OPTIONS.find((d) => d.value === duration)?.label ?? "";
      const name = `Repertório ${occasion} - ${sizeLabel}`;

      // Create setlist
      const newSetlist = await createSetlist({ name });

      // Insert items
      const items = selected.map((song, i) => ({
        setlist_id: newSetlist.id,
        song_id: song.id,
        position: i + 1,
      }));
      const { error: itemsError } = await supabase.from("setlist_items").insert(items);
      if (itemsError) throw itemsError;

      toast.success(`Repertório gerado com ${selected.length} músicas!`);
      onOpenChange(false);
      onCreated(newSetlist.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar repertório");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador Automático de Repertório
          </DialogTitle>
          <DialogDescription>
            Configure as preferências e o sistema criará um repertório aleatório para você.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Styles */}
          <div className="space-y-2">
            <Label>Estilos Musicais</Label>
            <p className="text-xs text-muted-foreground">Deixe vazio para incluir todos</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((style) => (
                <Badge
                  key={style}
                  variant={selectedStyles.has(style) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => toggleStyle(style)}
                >
                  {style}
                </Badge>
              ))}
            </div>
          </div>

          {/* Occasion */}
          <div className="space-y-2">
            <Label>Ocasião</Label>
            <Select value={occasion} onValueChange={setOccasion}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ocasião" />
              </SelectTrigger>
              <SelectContent>
                {OCCASIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size mode toggle */}
          <div className="space-y-3">
            <Label>Definir tamanho por:</Label>
            <RadioGroup
              value={sizeMode}
              onValueChange={(v) => setSizeMode(v as "duration" | "quantity")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="quantity" id="qty" />
                <Label htmlFor="qty" className="cursor-pointer font-normal">Quantidade de Músicas</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="duration" id="dur" />
                <Label htmlFor="dur" className="cursor-pointer font-normal">Duração</Label>
              </div>
            </RadioGroup>

            {sizeMode === "quantity" ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quantas músicas?</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duração total</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Generate button */}
          <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A gerar o repertório ideal...
              </>
            ) : (
              <>
                <Music className="h-4 w-4" />
                Gerar Repertório
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
