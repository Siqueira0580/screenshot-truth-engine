import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music2, MonitorPlay, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSong, fetchArtists, incrementAccessCount } from "@/lib/supabase-queries";
import { transposeText, transposeKey } from "@/lib/transpose";
import Teleprompter from "@/components/Teleprompter";

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

function highlightChords(text: string) {
  return text.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g,
    '<span class="chord">$1</span>'
  );
}

export default function SongDetailPage() {
  const { id } = useParams();
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const { data: song, isLoading } = useQuery({
    queryKey: ["song", id],
    queryFn: () => fetchSong(id!),
    enabled: !!id,
  });

  const { data: artists = [] } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  const artistPhoto = song?.artist
    ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url || null
    : null;

  useEffect(() => {
    if (id) {
      incrementAccessCount(id);
    }
  }, [id]);

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
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <Button variant="ghost" asChild className="gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight">{song.title}</h1>
          {song.body_text && (
            <Button onClick={() => setTeleprompterOpen(true)} className="gap-2">
              <MonitorPlay className="h-4 w-4" />
              Teleprompter
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          {song.artist && (
            <span className="flex items-center gap-1">
              <Music2 className="h-4 w-4" />
              {song.artist}
            </span>
          )}
          {song.composer && <span>Compositor: {song.composer}</span>}
          {displayKey && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-mono font-semibold text-primary">
              Tom: {displayKey}
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.style && <span>{song.style}</span>}
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

      {displayBody && (
        <div className="rounded-lg border border-border bg-card p-6">
          <pre
            className="chord-text whitespace-pre-wrap font-mono text-sm leading-7 text-foreground"
            dangerouslySetInnerHTML={{ __html: highlightChords(displayBody) }}
          />
        </div>
      )}
      <Teleprompter
        songs={[{ ...song, body_text: displayBody, musical_key: displayKey, artist_photo_url: artistPhoto, speed: song.default_speed ?? 250 }]}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
    </div>
  );
}
