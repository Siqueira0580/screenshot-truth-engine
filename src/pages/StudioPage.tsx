import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, Pause, Square, Upload, Music2, Mic2, Drum, Piano,
  Volume2, ChevronUp, ChevronDown, Loader2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchSongs, fetchArtists } from "@/lib/supabase-queries";
import { MultitrackEngine, StemType } from "@/lib/audio-engine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AudioTrack {
  id: string;
  song_id: string;
  file_full: string | null;
  file_vocals: string | null;
  file_percussion: string | null;
  file_harmony: string | null;
}

const STEM_META: { type: StemType; label: string; icon: typeof Music2; color: string }[] = [
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

export default function StudioPage() {
  const queryClient = useQueryClient();
  const engineRef = useRef<MultitrackEngine | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [masterVol, setMasterVol] = useState(80);
  const [stemVols, setStemVols] = useState<Record<StemType, number>>({
    full: 100, vocals: 100, percussion: 100, harmony: 100,
  });
  const [uploading, setUploading] = useState<StemType | null>(null);
  const fileRefs = useRef<Record<StemType, HTMLInputElement | null>>({
    full: null, vocals: null, percussion: null, harmony: null,
  });

  const { data: songs = [] } = useQuery({ queryKey: ["songs"], queryFn: fetchSongs });
  const { data: artists = [] } = useQuery({ queryKey: ["artists"], queryFn: fetchArtists });

  const { data: audioTrack, refetch: refetchTrack } = useQuery({
    queryKey: ["audio_track", selectedSongId],
    queryFn: async () => {
      if (!selectedSongId) return null;
      const { data } = await supabase
        .from("audio_tracks")
        .select("*")
        .eq("song_id", selectedSongId)
        .maybeSingle();
      return data as AudioTrack | null;
    },
    enabled: !!selectedSongId,
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

  // Sync volumes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMasterVolume(masterVol / 100);
  }, [masterVol]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, vol] of Object.entries(stemVols)) {
      engine.setStemVolume(type as StemType, vol / 100);
    }
  }, [stemVols]);

  useEffect(() => {
    engineRef.current?.setPitch(pitch);
  }, [pitch]);

  const handlePlay = () => engineRef.current?.play();
  const handlePause = () => engineRef.current?.pause();
  const handleStop = () => engineRef.current?.stop();
  const handleSeek = (val: number[]) => engineRef.current?.seek(val[0]);

  const handleUploadStem = async (type: StemType, file: File) => {
    if (!selectedSongId) return;
    setUploading(type);

    try {
      const ext = file.name.split(".").pop();
      const path = `${selectedSongId}/${type}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("audio-stems")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("audio-stems").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const colMap: Record<StemType, string> = {
        full: "file_full", vocals: "file_vocals",
        percussion: "file_percussion", harmony: "file_harmony",
      };

      if (audioTrack) {
        await supabase
          .from("audio_tracks")
          .update({ [colMap[type]]: publicUrl })
          .eq("id", audioTrack.id);
      } else {
        await supabase
          .from("audio_tracks")
          .insert({ song_id: selectedSongId, [colMap[type]]: publicUrl });
      }

      // Parse artist - title from filename if uploading "full"
      if (type === "full") {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const match = baseName.match(/^(.+?)\s*-\s*(.+)$/);
        if (match) {
          const [, artist, title] = match;
          const song = songs.find(s => s.id === selectedSongId);
          if (song && !song.artist && !song.title.includes("-")) {
            await supabase.from("songs").update({
              artist: artist.trim(),
              title: title.trim(),
            }).eq("id", selectedSongId);
            queryClient.invalidateQueries({ queryKey: ["songs"] });
          }
        }
      }

      refetchTrack();
      toast.success(`${STEM_META.find(s => s.type === type)?.label} carregado!`);
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteStem = async (type: StemType) => {
    if (!audioTrack) return;
    const colMap: Record<StemType, string> = {
      full: "file_full", vocals: "file_vocals",
      percussion: "file_percussion", harmony: "file_harmony",
    };
    await supabase.from("audio_tracks").update({ [colMap[type]]: null }).eq("id", audioTrack.id);
    refetchTrack();
    toast.success("Faixa removida");
  };

  const selectedSong = songs.find(s => s.id === selectedSongId);
  const artistPhoto = selectedSong?.artist
    ? artists.find(a => a.name.toLowerCase() === selectedSong.artist!.toLowerCase())?.photo_url
    : null;

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  const hasAnyStem = audioTrack && (
    audioTrack.file_full || audioTrack.file_vocals ||
    audioTrack.file_percussion || audioTrack.file_harmony
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estúdio de Ensaio</h1>
        <p className="text-muted-foreground mt-1">Player multitrack com mixer e transposição</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Song selector */}
        <div className="space-y-3">
          <Input
            placeholder="Buscar música..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9"
          />
          <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
            {filteredSongs.map(song => {
              const photo = song.artist
                ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url
                : null;
              return (
                <button
                  key={song.id}
                  onClick={() => setSelectedSongId(song.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                    selectedSongId === song.id
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-secondary border border-transparent"
                  )}
                >
                  {photo ? (
                    <img src={photo} alt="" className="h-9 w-9 rounded-md object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
                      <Music2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    {song.artist && (
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio panel */}
        <div className="space-y-5">
          {!selectedSongId ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-lg border border-dashed border-border">
              <Music2 className="h-12 w-12 mb-4 opacity-40" />
              <p>Selecione uma música para começar</p>
            </div>
          ) : (
            <>
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
                  <h2 className="text-xl font-bold truncate">{selectedSong?.title}</h2>
                  {selectedSong?.artist && (
                    <p className="text-muted-foreground">{selectedSong.artist}</p>
                  )}
                  {selectedSong?.musical_key && (
                    <span className="inline-block mt-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                      Tom: {selectedSong.musical_key}
                    </span>
                  )}
                </div>
              </div>

              {/* Transport controls + seek */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline" size="icon"
                    onClick={handleStop}
                    disabled={!hasAnyStem}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={isPlaying ? handlePause : handlePlay}
                    disabled={!hasAnyStem || loading}
                    className="h-12 w-12 rounded-full"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>

                  <div className="flex-1 space-y-1">
                    <Slider
                      value={[currentTime]}
                      max={duration || 1}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Master volume + Pitch */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Volume2 className="h-3.5 w-3.5" />
                      Volume Mestre
                    </label>
                    <Slider
                      value={[masterVol]}
                      max={100}
                      step={1}
                      onValueChange={v => setMasterVol(v[0])}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Transposição (semitons)
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => setPitch(p => p - 1)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <span className="font-mono text-sm font-semibold w-10 text-center">
                        {pitch > 0 ? `+${pitch}` : pitch}
                      </span>
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => setPitch(p => p + 1)}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      {pitch !== 0 && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPitch(0)}>
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mixer faders */}
              <div className="p-4 rounded-xl bg-card border border-border">
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
                  Mixer — Stems
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {STEM_META.map(({ type, label, icon: Icon, color }) => {
                    const colMap: Record<StemType, keyof AudioTrack> = {
                      full: "file_full", vocals: "file_vocals",
                      percussion: "file_percussion", harmony: "file_harmony",
                    };
                    const hasFile = audioTrack && audioTrack[colMap[type]];

                    return (
                      <div
                        key={type}
                        className={cn(
                          "rounded-lg border p-3 space-y-3 transition-colors",
                          hasFile ? "border-border bg-secondary/30" : "border-dashed border-border/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", color)} />
                            <span className="text-xs font-medium">{label}</span>
                          </div>
                          {hasFile && (
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => handleDeleteStem(type)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>

                        {hasFile ? (
                          <div className="space-y-1">
                            <Slider
                              value={[stemVols[type]]}
                              max={100}
                              step={1}
                              onValueChange={v => setStemVols(prev => ({ ...prev, [type]: v[0] }))}
                            />
                            <p className="text-[10px] text-muted-foreground text-center font-mono">
                              {stemVols[type]}%
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <input
                              ref={el => { fileRefs.current[type] = el; }}
                              type="file"
                              accept=".mp3,.wav,.ogg,.m4a,.flac"
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadStem(type, f);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              variant="ghost" size="sm"
                              className="text-xs gap-1.5"
                              disabled={uploading === type}
                              onClick={() => fileRefs.current[type]?.click()}
                            >
                              {uploading === type ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              Upload
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
