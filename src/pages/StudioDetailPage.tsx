import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play, Pause, Square, Upload, Music2, Mic2, Drum, Piano, Guitar,
  Volume2, VolumeX, ChevronUp, ChevronDown, Loader2, Scissors, Star, ArrowLeft, ScanSearch, BookOpen,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { fetchSong, fetchArtists, updateSong } from "@/lib/supabase-queries";
import { MultitrackEngine, StemType } from "@/lib/audio-engine";
import { analyzeAudio, getTransposedKey } from "@/lib/key-detection";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AudioTrack {
  id: string;
  song_id: string;
  file_full: string | null;
  file_vocals: string | null;
  file_percussion: string | null;
  file_harmony: string | null;
  file_guitar: string | null;
}

const STEM_DISPLAY: { type: StemType; label: string; icon: typeof Music2; color: string }[] = [
  { type: "full", label: "Mix Completo", icon: Music2, color: "text-primary" },
  { type: "vocals", label: "Voz", icon: Mic2, color: "text-blue-400" },
  { type: "percussion", label: "Percussão", icon: Drum, color: "text-orange-400" },
  { type: "harmony", label: "Harmonia", icon: Piano, color: "text-emerald-400" },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function StudioDetailPage() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const engineRef = useRef<MultitrackEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [masterVol, setMasterVol] = useState(80);
  const [stemVols, setStemVols] = useState<Record<StemType, number>>({
    full: 100, vocals: 100, percussion: 100, harmony: 100,
  });
  const [mutedStems, setMutedStems] = useState<Record<StemType, boolean>>({
    full: false, vocals: false, percussion: false, harmony: false,
  });
  const [soloStems, setSoloStems] = useState<Record<StemType, boolean>>({
    full: false, vocals: false, percussion: false, harmony: false,
  });
  const [uploadingNew, setUploadingNew] = useState(false);
  const [separating, setSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState({ percent: 0, label: "" });
  const [detectingKey, setDetectingKey] = useState(false);

  const { data: song, refetch: refetchSong } = useQuery({
    queryKey: ["song", songId],
    queryFn: () => fetchSong(songId!),
    enabled: !!songId,
  });

  const { data: artists = [] } = useQuery({ queryKey: ["artists"], queryFn: fetchArtists });

  const { data: audioTrack, refetch: refetchTrack } = useQuery({
    queryKey: ["audio_track", songId],
    queryFn: async () => {
      if (!songId) return null;
      const { data } = await supabase
        .from("audio_tracks")
        .select("*")
        .eq("song_id", songId)
        .maybeSingle();
      return data as AudioTrack | null;
    },
    enabled: !!songId,
  });

  // Initialize engine
  useEffect(() => {
    const engine = new MultitrackEngine();
    engineRef.current = engine;
    engine.setCallbacks({
      onTimeUpdate: (t, d) => { setCurrentTime(t); setDuration(d); },
      onPlayStateChange: setIsPlaying,
      onLoadStateChange: setLoading,
    });
    return () => engine.dispose();
  }, []);

  // Load stems when track changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !audioTrack) return;

    engine.stop();
    const loadStems = async () => {
      const stemMap: Record<StemType, string | null> = {
        full: audioTrack.file_full,
        vocals: audioTrack.file_vocals,
        percussion: audioTrack.file_percussion,
        harmony: audioTrack.file_harmony,
      };

      for (const [type, url] of Object.entries(stemMap)) {
        if (url) {
          try {
            await engine.loadStem(type as StemType, url);
          } catch (e) {
            console.error(`Failed to load ${type}:`, e);
          }
        }
      }
    };
    loadStems();
  }, [audioTrack]);

  useEffect(() => { engineRef.current?.setMasterVolume(masterVol / 100); }, [masterVol]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, vol] of Object.entries(stemVols)) {
      const st = type as StemType;
      const isMuted = mutedStems[st];
      const anySoloed = Object.values(soloStems).some(Boolean);
      const shouldPlay = anySoloed ? soloStems[st] && !isMuted : !isMuted;
      engine.setStemVolume(st, shouldPlay ? vol / 100 : 0);
    }
  }, [stemVols, mutedStems, soloStems]);

  useEffect(() => { engineRef.current?.setPitch(pitch); }, [pitch]);

  const handlePlay = () => engineRef.current?.play();
  const handlePause = () => engineRef.current?.pause();
  const handleStop = () => engineRef.current?.stop();
  const handleSeek = (val: number[]) => engineRef.current?.seek(val[0]);

  // Audio analysis (key + BPM)
  const handleAnalyzeAudio = async () => {
    if (!audioTrack?.file_full || !songId) return;
    setDetectingKey(true);
    try {
      const result = await analyzeAudio(audioTrack.file_full);
      const keyValue = `${result.key.key}${result.key.mode === "Minor" ? "m" : ""}`;
      await updateSong(songId, { musical_key: keyValue, bpm: result.bpm });
      refetchSong();
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success(
        `Tom: ${result.key.display} · BPM: ${result.bpm}`
      );
    } catch (err: any) {
      toast.error(`Erro na análise: ${err.message}`);
    } finally {
      setDetectingKey(false);
    }
  };

  const handleSeparateStems = async () => {
    if (!audioTrack?.file_full || !songId) return;

    setSeparating(true);
    setSeparationProgress({ percent: 5, label: "Iniciando separação..." });
    const toastId = toast.loading("Iniciando separação de stems...");

    try {
      const { data: startData, error: startError } = await supabase.functions.invoke("separate-stems", {
        body: { action: "start", audio_url: audioTrack.file_full, song_id: songId },
      });

      if (startError) throw startError;
      if (!startData?.prediction_id) throw new Error(startData?.error || "Falha ao iniciar");

      const predictionId = startData.prediction_id;
      setSeparationProgress({ percent: 15, label: "Enviado para IA..." });
      toast.loading("Processando IA... Isso pode levar 3-5 minutos.", { id: toastId });

      const maxPolls = 60;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, 10000));

        const { data: pollData, error: pollError } = await supabase.functions.invoke("separate-stems", {
          body: { action: "poll", prediction_id: predictionId, song_id: songId },
        });

        if (pollError) throw pollError;

        const status = pollData?.status;
        if (status === "processing" || status === "starting") {
          const pct = Math.min(15 + Math.round((i / maxPolls) * 75), 90);
          setSeparationProgress({ percent: pct, label: `Processando IA... (${(i + 1) * 10}s)` });
          toast.loading(`Processando IA... (${(i + 1) * 10}s)`, { id: toastId });
          continue;
        }

        if (status === "succeeded") {
          setSeparationProgress({ percent: 100, label: "Stems prontos!" });
          toast.success(`Stems separados com sucesso! (${pollData.stems?.length || 0} faixas)`, { id: toastId });
          refetchTrack();
          return;
        }

        if (status === "failed" || status === "canceled") {
          throw new Error(pollData?.error || `Separação ${status}`);
        }
      }

      throw new Error("Timeout: separação demorou mais de 10 minutos");
    } catch (err: any) {
      toast.error(`Erro na separação: ${err.message}`, { id: toastId });
    } finally {
      setSeparating(false);
      setTimeout(() => setSeparationProgress({ percent: 0, label: "" }), 2000);
    }
  };

  const artistPhoto = song?.artist
    ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url
    : null;

  const hasAnyStem = audioTrack && (
    audioTrack.file_full || audioTrack.file_vocals ||
    audioTrack.file_percussion || audioTrack.file_harmony
  );

  const hasSeparatedStems = audioTrack && (
    audioTrack.file_vocals || audioTrack.file_percussion || audioTrack.file_harmony
  );

  // Parse original key for transposition display
  const originalKey = song?.musical_key;
  const originalKeyNote = originalKey ? originalKey.replace("m", "").replace("#", "#") : null;
  const isMinor = originalKey?.endsWith("m") || false;
  const transposedKeyNote = originalKeyNote ? getTransposedKey(originalKeyNote, pitch) : null;
  const transposedKeyDisplay = transposedKeyNote
    ? `${transposedKeyNote}${isMinor ? "m" : ""}`
    : null;

  if (!songId) return null;

  return (
    <div className="space-y-5">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{song?.title || "Carregando..."}</h1>
          {song?.artist && <p className="text-muted-foreground text-sm">{song.artist}</p>}
        </div>
        {song?.body_text && (
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => navigate(`/study/${songId}`)}>
            <BookOpen className="h-4 w-4" /> Modo Estudo
          </Button>
        )}
      </div>

      {/* Now playing header */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
        {artistPhoto ? (
          <img src={artistPhoto} alt="" className="h-16 w-16 rounded-lg object-cover shadow-lg" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center">
            <Music2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold truncate">{song?.title}</h2>
          {song?.artist && <p className="text-muted-foreground">{song.artist}</p>}
        </div>

        {/* Key + BPM display / detection */}
        <div className="flex items-center gap-3 shrink-0">
          {(originalKey || song?.bpm) ? (
            <div className="flex items-center gap-2">
              {originalKey && (
                <div className="text-center">
                  <span className="inline-block rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-mono font-bold text-primary">
                    {pitch !== 0 && transposedKeyDisplay ? transposedKeyDisplay : originalKey}
                  </span>
                  {pitch !== 0 && transposedKeyDisplay && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      orig: {originalKey}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tom</p>
                </div>
              )}
              {song?.bpm && (
                <div className="text-center">
                  <span className="inline-block rounded-lg bg-accent/50 px-3 py-1.5 text-sm font-mono font-bold text-accent-foreground">
                    {song.bpm}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">BPM</p>
                </div>
              )}
              {/* Re-analyze button */}
              {audioTrack?.file_full && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAnalyzeAudio} disabled={detectingKey} title="Re-analisar áudio">
                  {detectingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          ) : audioTrack?.file_full ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleAnalyzeAudio}
              disabled={detectingKey}
            >
              {detectingKey ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScanSearch className="h-3.5 w-3.5" />
              )}
              {detectingKey ? "Analisando..." : "Analisar Áudio"}
            </Button>
          ) : null}
        </div>

        {audioTrack?.file_full && !hasSeparatedStems && (
          <Button onClick={handleSeparateStems} disabled={separating} className="gap-2 shrink-0" variant="outline">
            {separating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            {separating ? "Separando..." : "Separar Stems"}
          </Button>
        )}
        {hasSeparatedStems && (
          <span className="text-xs text-emerald-400 font-medium shrink-0 flex items-center gap-1">
            <Scissors className="h-3.5 w-3.5" /> Stems prontos
          </span>
        )}
      </div>

      {/* Separation progress */}
      {separating && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {separationProgress.label}
            </span>
            <span className="font-mono text-primary font-semibold">{separationProgress.percent}%</span>
          </div>
          <Progress value={separationProgress.percent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            A IA está separando voz, percussão e harmonia. Isso pode levar 3-5 minutos.
          </p>
        </div>
      )}

      {/* Upload if no audio */}
      {!audioTrack?.file_full && (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border bg-card/50">
          <Upload className="h-10 w-10 mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">Esta música ainda não tem áudio</p>
          <input
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.flac"
            className="hidden"
            id="upload-existing"
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f || !songId) return;
              setUploadingNew(true);
              try {
                const ext = f.name.split(".").pop();
                const path = `${songId}/full.${ext}`;
                const { error: upErr } = await supabase.storage
                  .from("audio-stems")
                  .upload(path, f, { upsert: true, contentType: f.type || "audio/mpeg" });
                if (upErr) throw upErr;
                const { data: urlData } = supabase.storage.from("audio-stems").getPublicUrl(path);
                const { data: { user } } = await supabase.auth.getUser();

                if (audioTrack) {
                  const { error: dbErr } = await supabase.from("audio_tracks").update({ file_full: urlData.publicUrl }).eq("id", audioTrack.id);
                  if (dbErr) throw dbErr;
                } else {
                  const { error: dbErr } = await supabase.from("audio_tracks").insert({
                    song_id: songId,
                    file_full: urlData.publicUrl,
                    user_id: user?.id || null,
                  });
                  if (dbErr) throw dbErr;
                }
                await refetchTrack();
                toast.success("Mix completo enviado!");
              } catch (err: any) {
                console.error("Upload error:", err);
                toast.error(`Erro: ${err.message}`);
              } finally {
                setUploadingNew(false);
                e.target.value = "";
              }
            }}
          />
          <Button variant="outline" className="gap-2" disabled={uploadingNew} onClick={() => document.getElementById("upload-existing")?.click()}>
            {uploadingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar Mix Completo
          </Button>
        </div>
      )}

      {/* Transport controls */}
      {hasAnyStem && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={isPlaying ? handlePause : handlePlay} disabled={loading} className="h-12 w-12 rounded-full">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <div className="flex-1 space-y-1">
              <Slider value={[currentTime]} max={duration || 1} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5" /> Volume Mestre
              </label>
              <Slider value={[masterVol]} max={100} step={1} onValueChange={v => setMasterVol(v[0])} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Transposição {originalKey && (
                  <span className="text-primary font-mono ml-1">
                    {pitch !== 0 && transposedKeyDisplay ? `${originalKey} → ${transposedKeyDisplay}` : originalKey}
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPitch(p => p - 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-sm font-semibold w-10 text-center">
                  {pitch > 0 ? `+${pitch}` : pitch}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPitch(p => p + 1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                {pitch !== 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPitch(0)}>Reset</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mixer faders */}
      {hasAnyStem && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Mixer — Stems</h3>
            {(Object.values(mutedStems).some(Boolean) || Object.values(soloStems).some(Boolean)) && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                setMutedStems({ full: false, vocals: false, percussion: false, harmony: false });
                setSoloStems({ full: false, vocals: false, percussion: false, harmony: false });
              }}>
                Reset
              </Button>
            )}
          </div>
          <div className={cn("grid gap-4", hasSeparatedStems ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 max-w-xs")}>
            {STEM_DISPLAY.map(({ type, label, icon: Icon, color }) => {
              const colMap: Record<StemType, keyof AudioTrack> = {
                full: "file_full", vocals: "file_vocals",
                percussion: "file_percussion", harmony: "file_harmony",
              };
              const hasFile = audioTrack && audioTrack[colMap[type]];
              if (!hasFile) return null;

              const isMuted = mutedStems[type];
              const isSoloed = soloStems[type];
              const anySoloed = Object.values(soloStems).some(Boolean);
              const isEffectivelyMuted = anySoloed ? !isSoloed || isMuted : isMuted;

              return (
                <div key={type} className={cn(
                  "rounded-lg border p-3 space-y-3 transition-all",
                  isEffectivelyMuted ? "border-border bg-muted/30 opacity-50" : "border-border bg-secondary/30",
                  isSoloed && "border-primary/50 bg-primary/5 opacity-100 ring-1 ring-primary/20"
                )}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-xs font-medium flex-1">{label}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant={isMuted ? "default" : "outline"} size="sm" className="h-6 px-2 text-[10px] font-bold"
                      onClick={() => setMutedStems(prev => ({ ...prev, [type]: !prev[type] }))}>
                      <VolumeX className="h-3 w-3 mr-1" /> M
                    </Button>
                    <Button variant={isSoloed ? "default" : "outline"} size="sm" className="h-6 px-2 text-[10px] font-bold"
                      onClick={() => setSoloStems(prev => ({ ...prev, [type]: !prev[type] }))}>
                      <Star className="h-3 w-3 mr-1" /> S
                    </Button>
                  </div>
                  <Slider value={[stemVols[type]]} max={100} step={1}
                    onValueChange={v => setStemVols(prev => ({ ...prev, [type]: v[0] }))}
                    disabled={isEffectivelyMuted} />
                  <p className="text-[10px] text-muted-foreground text-center font-mono">{stemVols[type]}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
