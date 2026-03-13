import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, Upload, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchSongs, fetchArtists, createSong } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import GuidedTour from "@/components/GuidedTour";
import { useGuidedTour } from "@/hooks/useGuidedTour";

const STUDIO_TOUR_STEPS = [
  {
    target: "#tour-studio-title",
    title: "Estúdio de Ensaio",
    content: "Aqui você encontra o player multitrack para ensaiar suas músicas com mixer e transposição.",
  },
  {
    target: "#tour-studio-search",
    title: "Buscar Músicas",
    content: "Pesquise rapidamente qualquer música do seu repertório por título ou artista.",
  },
  {
    target: "#tour-studio-upload",
    title: "Enviar Áudio",
    content: "Faça upload de um arquivo de áudio (.mp3, .wav, etc.) para adicionar ao estúdio.",
  },
  {
    target: "#tour-studio-list",
    title: "Lista de Músicas",
    content: "Clique numa música para abrir o mixer multitrack com controle de stems, volume e transposição.",
  },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploadingNew, setUploadingNew] = useState(false);
  const newAudioRef = useRef<HTMLInputElement>(null);
  const { run: runTour, completeTour, replayTour } = useGuidedTour("studio_page");

  useState(() => {
    (window as any).__replayStudioTour = replayTour;
  });

  const { data: songs = [] } = useQuery({ queryKey: ["songs"], queryFn: fetchSongs });
  const { data: artists = [] } = useQuery({ queryKey: ["artists"], queryFn: fetchArtists });

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  const handleNewAudio = async (file: File) => {
    setUploadingNew(true);
    try {
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const match = baseName.match(/^(.+?)\s*-\s*(.+)$/);
      const title = match ? match[2].trim() : baseName;
      const artist = match ? match[1].trim() : undefined;

      const song = await createSong({ title, artist: artist || null });

      const ext = file.name.split(".").pop();
      const path = `${song.id}/full.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("audio-stems")
        .upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      // Create audio_tracks record first so RLS policy can validate ownership
      const { error: dbErr } = await supabase.from("audio_tracks").insert({
        song_id: song.id,
        file_full: path,
        user_id: user?.id || null,
      });
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success(`"${title}" adicionado!`);
      navigate(`/studio/${song.id}`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setUploadingNew(false);
    }
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      <GuidedTour steps={STUDIO_TOUR_STEPS} run={runTour} onFinish={completeTour} />

      <div id="tour-studio-title">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Estúdio de Ensaio</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Player multitrack com mixer e transposição</p>
      </div>

      {/* Search + Upload */}
      <div className="flex gap-2 w-full">
        <Input
          id="tour-studio-search"
          placeholder="Buscar música..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 flex-1 min-w-0 text-sm"
        />
        <input
          ref={newAudioRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,.flac"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleNewAudio(f);
            e.target.value = "";
          }}
        />
        <Button
          id="tour-studio-upload"
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          disabled={uploadingNew}
          onClick={() => newAudioRef.current?.click()}
        >
          {uploadingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>

      {/* Song grid */}
      <div id="tour-studio-list">
      {filteredSongs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-lg border border-dashed border-border">
          <Upload className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg mb-2">Envie um áudio para começar</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Clique em "Novo" para fazer upload de uma música
          </p>
          <Button className="gap-2" disabled={uploadingNew} onClick={() => newAudioRef.current?.click()}>
            {uploadingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar Mix Completo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredSongs.map(song => {
            const photo = song.artist
              ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url
              : null;
            return (
              <button
                key={song.id}
                onClick={() => navigate(`/studio/${song.id}`)}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 text-left transition-colors",
                  "hover:bg-secondary border border-border bg-card"
                )}
              >
                {photo ? (
                  <img src={photo} alt="" className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
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
      )}
      </div>
    </div>
  );
}
