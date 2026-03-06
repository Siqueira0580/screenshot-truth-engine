import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SetlistSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlist: {
    id: string;
    name: string;
    show_date?: string | null;
    show_duration?: number | null;
    start_time?: string | null;
    interval_duration?: number | null;
    end_time?: string | null;
    musicians?: string[] | null;
  } | null;
  onSave: (data: {
    name: string;
    show_date: string | null;
    show_duration: number | null;
    start_time: string | null;
    interval_duration: number | null;
    end_time: string | null;
    musicians: string[];
  }) => Promise<void>;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor((totalMin % 1440) / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export default function SetlistSettingsModal({ open, onOpenChange, setlist, onSave }: SetlistSettingsModalProps) {
  const [name, setName] = useState("");
  const [showDate, setShowDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [showDuration, setShowDuration] = useState<number | "">("");
  const [intervalDuration, setIntervalDuration] = useState<number | "">("");
  const [endTime, setEndTime] = useState("");
  const [endTimeManual, setEndTimeManual] = useState(false);
  const [musicians, setMusicians] = useState<string[]>([]);
  const [musicianInput, setMusicianInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (setlist && open) {
      setName(setlist.name || "");
      setShowDate(setlist.show_date ? new Date(setlist.show_date) : undefined);
      setStartTime(setlist.start_time || "");
      setShowDuration(setlist.show_duration ?? "");
      setIntervalDuration(setlist.interval_duration ?? "");
      setEndTime(setlist.end_time || "");
      setMusicians(Array.isArray(setlist.musicians) ? setlist.musicians : []);
      setEndTimeManual(false);
    }
  }, [setlist, open]);

  // Auto-calculate end_time
  useEffect(() => {
    if (endTimeManual) return;
    if (startTime && (showDuration || intervalDuration)) {
      const total = (Number(showDuration) || 0) + (Number(intervalDuration) || 0);
      if (total > 0) {
        setEndTime(addMinutesToTime(startTime, total));
      }
    }
  }, [startTime, showDuration, intervalDuration, endTimeManual]);

  const handleAddMusician = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && musicianInput.trim()) {
      e.preventDefault();
      if (!musicians.includes(musicianInput.trim())) {
        setMusicians((prev) => [...prev, musicianInput.trim()]);
      }
      setMusicianInput("");
    }
  }, [musicianInput, musicians]);

  const removeMusician = useCallback((name: string) => {
    setMusicians((prev) => prev.filter((m) => m !== name));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do repertório é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        show_date: showDate ? showDate.toISOString() : null,
        show_duration: showDuration ? Number(showDuration) : null,
        start_time: startTime || null,
        interval_duration: intervalDuration ? Number(intervalDuration) : null,
        end_time: endTime || null,
        musicians,
      });
      onOpenChange(false);
      toast.success("Configurações do show salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuração do Show</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Row 1: Name + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="setlist-name">Nome do Repertório</Label>
              <Input id="setlist-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Show Acústico" />
            </div>
            <div className="space-y-1.5">
              <Label>Data do Show</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !showDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {showDate ? format(showDate, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={showDate} onSelect={setShowDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 2: Schedule */}
          <div>
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Cronograma</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-xs">Início</Label>
                <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="show-duration" className="text-xs">Show (min)</Label>
                <Input
                  id="show-duration"
                  type="number"
                  min={0}
                  placeholder="120"
                  value={showDuration}
                  onChange={(e) => setShowDuration(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interval-dur" className="text-xs">Intervalo (min)</Label>
                <Input
                  id="interval-dur"
                  type="number"
                  min={0}
                  placeholder="15"
                  value={intervalDuration}
                  onChange={(e) => setIntervalDuration(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time" className="text-xs">Término</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setEndTimeManual(true);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Musicians */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Escala de Músicos</Label>
            <Input
              placeholder='Ex: João (Baixo) — pressione Enter'
              value={musicianInput}
              onChange={(e) => setMusicianInput(e.target.value)}
              onKeyDown={handleAddMusician}
            />
            {musicians.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {musicians.map((m) => (
                  <Badge key={m} variant="secondary" className="gap-1 pr-1">
                    {m}
                    <button onClick={() => removeMusician(m)} className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
