import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Music2 } from "lucide-react";
import { toast } from "sonner";
import {
  getSpotifyToken,
  startSpotifyAuth,
  getSpotifyUserId,
  searchSpotifyTrack,
  createSpotifyPlaylist,
  addTracksToPlaylist,
} from "@/lib/spotify-service";

interface SongItem {
  title: string;
  artist?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistName: string;
  songs: SongItem[];
}

interface TrackResult {
  title: string;
  artist?: string | null;
  status: "pending" | "found" | "not_found";
  uri?: string;
  spotifyName?: string;
  spotifyArtist?: string;
}

export default function SpotifyExportModal({ open, onOpenChange, setlistName, songs }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [results, setResults] = useState<TrackResult[]>([]);
  const [step, setStep] = useState<"idle" | "searching" | "creating" | "done">("idle");
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  const handleExport = async () => {
    const token = getSpotifyToken();
    if (!token) {
      startSpotifyAuth();
      return;
    }

    setIsExporting(true);
    setStep("searching");
    setPlaylistUrl(null);

    // Init results
    const trackResults: TrackResult[] = songs.map((s) => ({
      title: s.title,
      artist: s.artist,
      status: "pending",
    }));
    setResults([...trackResults]);

    try {
      // Search all tracks
      for (let i = 0; i < trackResults.length; i++) {
        const { title, artist } = trackResults[i];
        try {
          const result = await searchSpotifyTrack(title, artist || undefined);
          if (result) {
            trackResults[i] = { ...trackResults[i], status: "found", uri: result.uri, spotifyName: result.name, spotifyArtist: result.artist };
          } else {
            trackResults[i] = { ...trackResults[i], status: "not_found" };
          }
        } catch (err: any) {
          if (err.message === "SPOTIFY_EXPIRED" || err.message === "SPOTIFY_FORBIDDEN") {
            toast.error("Sessão do Spotify expirou ou sem permissões. Reconecte ao Spotify.");
            setStep("idle");
            setIsExporting(false);
            return;
          }
          trackResults[i] = { ...trackResults[i], status: "not_found" };
        }
        setResults([...trackResults]);
      }

      const foundUris = trackResults.filter((t) => t.status === "found").map((t) => t.uri!);
      if (foundUris.length === 0) {
        toast.error("Nenhuma música encontrada no Spotify.");
        setStep("idle");
        setIsExporting(false);
        return;
      }

      // Create playlist
      setStep("creating");
      const userId = await getSpotifyUserId();
      const playlistId = await createSpotifyPlaylist(userId, setlistName, `Repertório exportado do SmartCifra • ${new Date().toLocaleDateString("pt-BR")}`);
      await addTracksToPlaylist(playlistId, foundUris);

      setPlaylistUrl(`https://open.spotify.com/playlist/${playlistId}`);
      setStep("done");
      toast.success(`Playlist "${setlistName}" criada com ${foundUris.length} músicas no seu Spotify!`);
    } catch (err: any) {
      if (err.message === "SPOTIFY_EXPIRED" || err.message === "SPOTIFY_FORBIDDEN") {
        toast.error("Sessão do Spotify expirou ou sem permissões. Reconecte ao Spotify.");
        setStep("idle");
      } else {
        toast.error("Erro ao exportar: " + err.message);
        setStep("idle");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const foundCount = results.filter((r) => r.status === "found").length;
  const notFoundCount = results.filter((r) => r.status === "not_found").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isExporting) {
          onOpenChange(v);
          if (!v) {
            setStep("idle");
            setResults([]);
            setPlaylistUrl(null);
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Exportar para Spotify
          </DialogTitle>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Exporta o repertório "<strong>{setlistName}</strong>" com {songs.length} música(s) como uma playlist no Spotify.
            </p>
            <p className="text-xs text-muted-foreground">
              Será feita uma busca no Spotify para cada música. As que não forem encontradas serão ignoradas.
            </p>
            <Button onClick={handleExport} className="w-full gap-2">
              <Music2 className="h-4 w-4" />
              {getSpotifyToken() ? "Exportar Agora" : "Conectar ao Spotify e Exportar"}
            </Button>
          </div>
        )}

        {(step === "searching" || step === "creating" || step === "done") && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {step === "creating" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando playlist...
              </div>
            )}

            {step === "done" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ Playlist criada com sucesso! ({foundCount} de {songs.length} músicas encontradas)
                </p>
                {notFoundCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {notFoundCount} música(s) não encontrada(s) no catálogo do Spotify.
                  </p>
                )}
                {playlistUrl && (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Abrir no Spotify
                    </a>
                  </Button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/30">
                  {r.status === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                  {r.status === "found" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  {r.status === "not_found" && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <span className="truncate block text-xs">
                      {r.title}{r.artist ? ` — ${r.artist}` : ""}
                    </span>
                    {r.status === "found" && r.spotifyName && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        → {r.spotifyName} • {r.spotifyArtist}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {step === "done" && (
              <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                Fechar
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
