import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Music2, ChevronUp, ChevronDown, Wand2, Loader2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSong, fetchArtists, incrementAccessCount } from "@/lib/supabase-queries";
import { transposeText, transposeKey, transposeChordPro } from "@/lib/transpose";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Teleprompter from "@/components/Teleprompter";
import ChordText from "@/components/ChordText";
import ShowButton from "@/components/ShowButton";
import SongChordsFAB from "@/components/SongChordsFAB";
import AutoCipherViewer from "@/components/AutoCipherViewer";
import YouTubeSearchModal from "@/components/YouTubeSearchModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save } from "lucide-react";

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [aiChordPro, setAiChordPro] = useState<string | null>(null);
  const [confirmSaveAsDefault, setConfirmSaveAsDefault] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);

  const { data: song, isLoading } = useQuery({
    queryKey: ["song", id],
    queryFn: () => fetchSong(id!),
    enabled: !!id,
  });

  const { data: artists = [] } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  // Fetch existing AI chordpro from audio_tracks
  const { data: audioTrack } = useQuery({
    queryKey: ["audio_track_chordpro", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("audio_tracks")
        .select("id, ai_chordpro_text")
        .eq("song_id", id)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Load existing AI chordpro on mount
  useEffect(() => {
    if (audioTrack?.ai_chordpro_text) {
      setAiChordPro(audioTrack.ai_chordpro_text);
    }
  }, [audioTrack]);

  const artistPhoto = song?.artist
    ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url || null
    : null;

  useEffect(() => {
    if (id) {
      incrementAccessCount(id);
    }
  }, [id]);

  const handleGenerateCipher = async () => {
    if (!song?.body_text) {
      toast.error("A música precisa ter letra para gerar a cifra.");
      return;
    }

    setGenerating(true);
    const toastId = toast.loading("Gerando cifra com IA...");

    try {
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: {
          lyrics: song.body_text,
          song_title: song.title,
          artist: song.artist,
          audio_track_id: audioTrack?.id || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const chordpro = data?.chordpro;
      if (!chordpro) throw new Error("Nenhuma cifra gerada.");

      setAiChordPro(chordpro);

      // If no audio_track exists yet, create one to store the result
      if (!audioTrack?.id && id) {
        await supabase.from("audio_tracks").insert({
          song_id: id,
          ai_chordpro_text: chordpro,
        });
        queryClient.invalidateQueries({ queryKey: ["audio_track_chordpro", id] });
      }

      toast.success("Cifra gerada com sucesso!", { id: toastId });
    } catch (err: any) {
      toast.error(`Erro ao gerar cifra: ${err.message}`, { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveChordPro = async (updatedText: string) => {
    setAiChordPro(updatedText);
    if (audioTrack?.id) {
      const { error } = await supabase
        .from("audio_tracks")
        .update({ ai_chordpro_text: updatedText })
        .eq("id", audioTrack.id);
      if (error) {
        toast.error("Erro ao salvar edição.");
      } else {
        toast.success("Cifra atualizada!");
      }
    }
  };

  const handleSaveAsDefault = async () => {
    if (!aiChordPro || !id) return;
    try {
      const { error } = await supabase
        .from("songs")
        .update({ body_text: aiChordPro })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["song", id] });
      toast.success("Cifra IA salva como padrão!");
      setConfirmSaveAsDefault(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse bg-card rounded" />
        <div className="h-64 animate-pulse bg-card rounded-lg" />
      </div>
    );
  }

  if (!song) return <p className="text-muted-foreground">Música não encontrada.</p>;

  const ytId = extractYoutubeId(song.youtube_url);
  const displayKey = transposeKey(song.musical_key, transpose);
  const displayBody = song.body_text ? transposeText(song.body_text, transpose) : null;


  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6 animate-fade-in overflow-x-hidden">
      <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{song.title}</h1>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setYoutubeModalOpen(true)}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Youtube className="h-4 w-4 text-red-500" />
              <span className="hidden sm:inline">{song.youtube_url ? "Alterar YouTube" : "Vincular YouTube"}</span>
              <span className="sm:hidden">YouTube</span>
            </Button>
            {song.body_text && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateCipher}
                disabled={generating}
                className="gap-1.5 text-xs sm:text-sm"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{generating ? "Gerando..." : aiChordPro ? "Regerar Cifra IA" : "Gerar Cifra IA"}</span>
                <span className="sm:hidden">{generating ? "..." : "Cifra IA"}</span>
              </Button>
            )}
            {song.body_text && (
              <ShowButton onClick={() => setTeleprompterOpen(true)} compact />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
          {song.artist && (
            <span className="flex items-center gap-1">
              <Music2 className="h-3.5 w-3.5" />
              {song.artist}
            </span>
          )}
          {displayKey && (
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary text-xs">
              Tom: {displayKey}
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.style && <span className="hidden sm:inline">{song.style}</span>}
        </div>
      </div>

      {/* Transpose controls */}
      {song.body_text && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Transpor:</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTranspose((t) => t - 1)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm font-semibold text-foreground w-12 text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTranspose((t) => t + 1)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          {transpose !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTranspose(0)} className="text-xs text-muted-foreground">
              Original
            </Button>
          )}
        </div>
      )}

      {ytId && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${ytId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={song.title}
          />
        </div>
      )}

      {/* AI Cipher (priority) */}
      {aiChordPro && (
        <div className="rounded-lg border border-border bg-card p-3 sm:p-6 space-y-3">
          <AutoCipherViewer
            chordProText={transposeChordPro(aiChordPro, transpose)}
            onSave={handleSaveChordPro}
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => setConfirmSaveAsDefault(true)}
            className="gap-2 text-xs sm:text-sm"
          >
            <Save className="h-4 w-4" />
            Salvar como Padrão
          </Button>
        </div>
      )}

      {/* Confirm save as default modal */}
      <AlertDialog open={confirmSaveAsDefault} onOpenChange={setConfirmSaveAsDefault}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir cifra original?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja substituir a cifra original por esta nova versão gerada pela IA? A versão antiga será excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAsDefault}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plain text fallback (only when no AI cipher) */}
      {!aiChordPro && displayBody && (
        <div className="rounded-lg border border-border bg-card p-3 sm:p-6">
          <ChordText
            text={displayBody}
            className="chord-text whitespace-pre-wrap font-mono text-xs sm:text-sm leading-6 sm:leading-7 text-foreground"
          />
        </div>
      )}
      <Teleprompter
        songs={[{ ...song, body_text: displayBody, musical_key: displayKey, artist_photo_url: artistPhoto, speed: song.default_speed ?? 250 }]}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
      <SongChordsFAB bodyText={displayBody} />
      <YouTubeSearchModal
        open={youtubeModalOpen}
        onOpenChange={setYoutubeModalOpen}
        songId={id!}
        songTitle={song.title}
        songArtist={song.artist}
      />
    </div>
  );
}
