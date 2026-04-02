import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PRESENTATION_FONTS, type PresentationFontId } from "@/components/PresentationFontPicker";
import TextToolsPopover from "@/components/TextToolsPopover";
import FontPreviewModal from "@/components/FontPreviewModal";
import { Music2, ChevronUp, ChevronDown, Wand2, Loader2, Youtube, Play, Guitar, Pencil, Trash2, Save, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BackButton from "@/components/ui/BackButton";
import { fetchSong, fetchArtists, incrementAccessCount } from "@/lib/supabase-queries";
import { transposeText, transposeKey, transposeChordPro } from "@/lib/transpose";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useTypographyPrefs } from "@/hooks/useTypographyPrefs";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

import Teleprompter from "@/components/Teleprompter";
import ChordText from "@/components/ChordText";
import ShowButton from "@/components/ShowButton";
import SongChordsFAB from "@/components/SongChordsFAB";
import AutoCipherViewer from "@/components/AutoCipherViewer";
import YouTubeSearchModal from "@/components/YouTubeSearchModal";
import YouTubeMiniPlayer from "@/components/YouTubeMiniPlayer";
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

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

export default function SongDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { preferredInstrument, setPreferredInstrument } = useUserPreferences();
  const { isBold, isItalic, toggleBold, toggleItalic, typographyClasses } = useTypographyPrefs();
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [presentationFont, setPresentationFont] = useState<PresentationFontId>(() => {
    const saved = localStorage.getItem("@smartcifra:globalFont");
    return (saved && PRESENTATION_FONTS.some(f => f.id === saved) ? saved : "sans") as PresentationFontId;
  });
  const [transpose, setTranspose] = useState(0);
  const [songFontSize, setSongFontSize] = useState(() => {
    const saved = localStorage.getItem("@smartcifra:fontSize");
    return saved ? parseInt(saved, 10) : 16;
  });
  const [previewFont, setPreviewFont] = useState<PresentationFontId | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const handleFontChange = (newFont: PresentationFontId) => {
    setPreviewFont(newFont);
    setIsPreviewModalOpen(true);
  };

  const handleApplyLocal = (font: PresentationFontId) => {
    setPresentationFont(font);
  };

  const handleApplyGlobal = (font: PresentationFontId) => {
    setPresentationFont(font);
    localStorage.setItem("@smartcifra:globalFont", font);
  };
  const [generating, setGenerating] = useState(false);
  const [aiChordPro, setAiChordPro] = useState<string | null>(null);
  const [confirmSaveAsDefault, setConfirmSaveAsDefault] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [linkedVideoId, setLinkedVideoId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleInstrumentChange = async (value: string) => {
    const instrument = value as "guitar" | "cavaquinho" | "ukulele" | "keyboard";
    await setPreferredInstrument(instrument);
    toast.success(`Instrumento alterado para ${
      { guitar: "Violão", cavaquinho: "Cavaquinho", ukulele: "Ukulele", keyboard: "Teclado" }[instrument]
    }`);
  };

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

  

  const handleDeleteSong = async () => {
    if (!id) return;
    try {
      const { error } = await supabase.from("songs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Música excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      navigate("/songs");
    } catch (err: any) {
      console.error("Erro ao excluir música:", err);
      toast.error(`Erro ao excluir: ${err.message}`);
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

  const isOwner = user?.id === song.created_by || user?.id === song.user_id;
  const canEdit = !!user;
  const canDelete = isOwner || isAdmin;

  const ytId = linkedVideoId || extractYoutubeId(song.youtube_url);
  const displayKey = transposeKey(song.musical_key, transpose);
  const displayBody = song.body_text ? transposeText(song.body_text, transpose) : null;
  const currentFontFamily = PRESENTATION_FONTS.find(f => f.id === presentationFont)?.family;


  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6 landscape:space-y-2 animate-fade-in overflow-x-hidden">
      <div className="space-y-2 landscape:space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 landscape:gap-1">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl sm:text-4xl landscape:text-xl font-bold tracking-tight">{song.title}</h1>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/editar-musica/${song.id}`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {!isOwner && isAdmin ? "Editar (Admin)" : "Editar Música"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {!isOwner && isAdmin ? "Excluir (Admin)" : "Excluir"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
            {ytId && !playerVisible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPlayerVisible(true)}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <Play className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Ouvir Referência</span>
                <span className="sm:hidden">▶ Ouvir</span>
              </Button>
            )}
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
              <TextToolsPopover
                font={presentationFont}
                onFontChange={handleFontChange}
                fontSize={songFontSize}
                onFontSizeChange={(size) => {
                  setSongFontSize(size);
                  localStorage.setItem("@smartcifra:fontSize", String(size));
                }}
                isBold={isBold}
                isItalic={isItalic}
                onToggleBold={toggleBold}
                onToggleItalic={toggleItalic}
              />
            )}
            {song.body_text && (
              <ShowButton onClick={() => setTeleprompterOpen(true)} compact />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground landscape:hidden sm:landscape:flex">
          {song.artist && (
            <span className="flex items-center gap-1">
              <Music2 className="h-3.5 w-3.5" />
              {song.artist}
            </span>
          )}
          {displayKey && (
            <span className="inline-flex flex-col items-start rounded bg-primary/10 px-2 py-0.5 font-mono">
              <span className="text-lg font-black text-primary leading-tight">{displayKey}</span>
              {song.musical_key && displayKey !== song.musical_key && (
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Original: {song.musical_key}
                </span>
              )}
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.style && <span className="hidden sm:inline">{song.style}</span>}
        </div>
      </div>

      {/* Transpose + Instrument controls */}
      {song.body_text && (
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
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

          <div className="flex items-center gap-1.5">
            <Guitar className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={preferredInstrument} onValueChange={handleInstrumentChange}>
              <SelectTrigger className="h-8 w-[125px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guitar">Violão</SelectItem>
                <SelectItem value="cavaquinho">Cavaquinho</SelectItem>
                <SelectItem value="ukulele">Ukulele</SelectItem>
                <SelectItem value="keyboard">Teclado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Inline Mini Player (below header, above chords) */}
      {ytId && playerVisible && (
        <YouTubeMiniPlayer
          videoId={ytId}
          title={song.title}
          onClose={() => setPlayerVisible(false)}
        />
      )}

      {/* AI Cipher (priority) */}
      {aiChordPro && (
        <div
          className={cn("rounded-lg border border-border bg-card p-3 sm:p-6 space-y-3", typographyClasses)}
          style={{ fontFamily: currentFontFamily }}
        >
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

      {/* Font preview modal */}
      <FontPreviewModal
        open={isPreviewModalOpen}
        onOpenChange={setIsPreviewModalOpen}
        previewFont={previewFont}
        sampleText={(() => {
          const text = song.body_text || "";
          const lines = text.split("\n").filter(l => l.trim().length > 0);
          return lines.slice(0, 5).join("\n");
        })()}
        onApplyLocal={handleApplyLocal}
        onApplyGlobal={handleApplyGlobal}
      />

      {/* Plain text fallback (only when no AI cipher) */}
      {!aiChordPro && displayBody && (
        <div
          className={cn("rounded-lg border border-border bg-card p-3 sm:p-6", typographyClasses)}
          style={{ fontFamily: currentFontFamily }}
        >
          <ChordText
            text={displayBody}
            className="chord-text whitespace-pre-wrap text-xs sm:text-sm leading-6 sm:leading-7 text-foreground"
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
        onVideoLinked={(videoId) => {
          setLinkedVideoId(videoId);
          setPlayerVisible(true);
        }}
      />
      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteSong}
        title={`Excluir "${song.title}"?`}
        description="Tem certeza que deseja excluir esta música? Esta ação não pode ser desfeita e removerá a música da sua biblioteca e de qualquer repertório."
      />
    </div>
  );
}
