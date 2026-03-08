import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ScanResult {
  total: number;
  updated: number;
  failed: number;
}

type ScanState = "idle" | "scanning" | "processing" | "done" | "error";

interface ProcessingLog {
  title: string;
  artist: string | null;
  style?: string | null;
  bpm?: number | null;
  musical_key?: string | null;
  composer?: string | null;
  success: boolean;
}

const DELAY_MS = 600;

export default function MetadataScanner() {
  const [state, setState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [currentSong, setCurrentSong] = useState<string>("");

  const runScan = useCallback(async () => {
    setState("scanning");
    setResult(null);
    setProgress(0);
    setCurrent(0);
    setLogs([]);
    setCurrentSong("");

    try {
      // Fetch songs missing musical_key, style, bpm, or composer
      const { data: incompleteSongs, error } = await supabase
        .from("songs")
        .select("id, title, artist, musical_key, style, bpm, composer")
        .or("musical_key.is.null,style.is.null,bpm.is.null,composer.is.null,musical_key.eq.,style.eq.,composer.eq.")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const queue = (incompleteSongs || []).filter((s) => s.artist);

      if (queue.length === 0) {
        toast.info("Todas as músicas já possuem metadados completos!");
        setState("idle");
        return;
      }

      setTotal(queue.length);
      setState("processing");

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < queue.length; i++) {
        const song = queue[i];
        setCurrent(i + 1);
        setProgress(Math.round(((i + 1) / queue.length) * 100));
        setCurrentSong(`${song.title} — ${song.artist}`);

        try {
          const { data, error: fnError } = await supabase.functions.invoke("enrich-song", {
            body: {
              song_id: song.id,
              artist: song.artist,
              title: song.title,
              current_style: song.style,
              current_bpm: song.bpm,
              current_musical_key: song.musical_key,
              current_composer: song.composer,
            },
          });

          if (fnError) {
            failed++;
            setLogs((prev) => [...prev, { title: song.title, artist: song.artist, success: false }]);
          } else if (data?.success) {
            updated++;
            setLogs((prev) => [
              ...prev,
              {
                title: song.title,
                artist: song.artist,
                style: data.style,
                bpm: data.bpm,
                musical_key: data.musical_key,
                composer: data.composer,
                success: true,
              },
            ]);
          } else {
            failed++;
            setLogs((prev) => [...prev, { title: song.title, artist: song.artist, success: false }]);
          }
        } catch {
          failed++;
          setLogs((prev) => [...prev, { title: song.title, artist: song.artist, success: false }]);
        }

        // Throttle between requests
        if (i < queue.length - 1) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      setResult({ total: queue.length, updated, failed });
      setState("done");
      setCurrentSong("");
      toast.success(`Varredura concluída! ${updated} músicas atualizadas.`);
    } catch (e) {
      console.error("Metadata scan error:", e);
      setState("error");
      toast.error("Erro ao executar a varredura de metadados.");
    }
  }, []);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Manutenção do Estúdio
        </CardTitle>
        <CardDescription>
          Preencha automaticamente o tom, estilo, BPM e compositores das músicas com campos vazios usando IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "idle" && (
          <Button onClick={runScan} className="w-full sm:w-auto gap-2">
            <Sparkles className="h-4 w-4" />
            Auto-Preencher Metadados (IA)
          </Button>
        )}

        {state === "scanning" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Buscando músicas incompletas…</span>
          </div>
        )}

        {state === "processing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-foreground">
                Analisando {current} de {total}…
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {currentSong && (
              <p className="text-xs text-primary font-medium truncate">
                🎵 Processando: {currentSong}
              </p>
            )}
            {/* Live log of last 3 processed songs */}
            {logs.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {logs.slice(-3).map((log, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground truncate">
                    {log.success ? "✅" : "❌"} {log.title}
                    {log.success && (
                      <span className="ml-1 text-primary/70">
                        {[
                          log.musical_key && `Tom: ${log.musical_key}`,
                          log.style && `Estilo: ${log.style}`,
                          log.bpm && `BPM: ${log.bpm}`,
                          log.composer && `Comp: ${log.composer}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Não feche esta página durante o processamento
            </p>
          </div>
        )}

        {state === "done" && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Varredura concluída!</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Total analisadas: {result.total}</p>
              <p>Atualizadas com sucesso: {result.updated}</p>
              {result.failed > 0 && <p>Falhas: {result.failed}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setState("idle"); setResult(null); setLogs([]); }}>
              Executar novamente
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Erro na varredura</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setState("idle")}>
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
