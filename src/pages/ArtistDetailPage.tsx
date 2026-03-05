import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music2, Eye, SortAsc, SortDesc, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchArtists, fetchSongsByArtist } from "@/lib/supabase-queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "alpha_asc" | "alpha_desc" | "most_accessed" | "recent";

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "alpha_asc", label: "A → Z", icon: <SortAsc className="h-4 w-4" /> },
  { value: "alpha_desc", label: "Z → A", icon: <SortDesc className="h-4 w-4" /> },
  { value: "most_accessed", label: "Mais Acessadas", icon: <TrendingUp className="h-4 w-4" /> },
  { value: "recent", label: "Recentes", icon: <Clock className="h-4 w-4" /> },
];

export default function ArtistDetailPage() {
  const { id } = useParams();
  const [sort, setSort] = useState<SortOption>("alpha_asc");

  const { data: artists = [] } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  const artist = artists.find((a) => a.id === id);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["artist-songs", artist?.name, sort],
    queryFn: () => fetchSongsByArtist(artist!.name, sort),
    enabled: !!artist,
  });

  if (!artist) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-2">
          <Link to="/artists"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <p className="text-muted-foreground">Artista não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" asChild className="gap-2">
        <Link to="/artists">
          <ArrowLeft className="h-4 w-4" />
          Artistas
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl">
          {artist.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{artist.name}</h1>
          {artist.about && (
            <p className="text-muted-foreground mt-1">{artist.about}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {songs.length} música{songs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Ordenar por:</span>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.icon}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Songs list */}
      {isLoading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Music2 className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhuma música deste artista</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {songs.map((song, i) => (
            <Link
              key={song.id}
              to={`/songs/${song.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-sm font-bold">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{song.title}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {song.musical_key && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                      {song.musical_key}
                    </span>
                  )}
                  {song.bpm && <span>{song.bpm} BPM</span>}
                  {(song as any).access_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {(song as any).access_count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
