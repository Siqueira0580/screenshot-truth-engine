import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music2, Youtube, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSong } from "@/lib/supabase-queries";
import Teleprompter from "@/components/Teleprompter";

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

function highlightChords(text: string) {
  // Highlight chord patterns like [Am], [C#m7], etc. or standalone chords
  return text.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g,
    '<span class="chord">$1</span>'
  );
}

export default function SongDetailPage() {
  const { id } = useParams();
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const { data: song, isLoading } = useQuery({
    queryKey: ["song", id],
    queryFn: () => fetchSong(id!),
    enabled: !!id,
  });

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
          {song.musical_key && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-mono font-semibold text-primary">
              Tom: {song.musical_key}
            </span>
          )}
          {song.bpm && <span>{song.bpm} BPM</span>}
          {song.style && <span>{song.style}</span>}
        </div>
      </div>

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

      {song.body_text && (
        <div className="rounded-lg border border-border bg-card p-6">
          <pre
            className="chord-text whitespace-pre-wrap font-mono text-sm leading-7 text-foreground"
            dangerouslySetInnerHTML={{ __html: highlightChords(song.body_text) }}
          />
        </div>
      )}
      <Teleprompter
        songs={[song]}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
    </div>
  );
}
