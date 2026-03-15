import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Music2, Plus, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ArtistStat {
  name: string;
  count: number;
  photo_url: string | null;
}

async function fetchUserExploreData(userId: string) {
  const { data: libraryData, error } = await supabase
    .from("user_library")
    .select("songs!inner(id, title, artist, created_at, access_count)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) throw error;

  const songs = (libraryData || []).map((r: any) => r.songs);

  // Build artist stats
  const artistMap = new Map<string, number>();
  for (const s of songs) {
    if (s.artist) {
      artistMap.set(s.artist, (artistMap.get(s.artist) || 0) + 1);
    }
  }

  const topArtistNames = [...artistMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let artistStats: ArtistStat[] = [];
  if (topArtistNames.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("name, photo_url")
      .in("name", topArtistNames.map(([n]) => n));

    const photoMap = new Map<string, string | null>();
    for (const a of artists || []) {
      photoMap.set(a.name.toLowerCase(), a.photo_url);
    }

    artistStats = topArtistNames.map(([name, count]) => ({
      name,
      count,
      photo_url: photoMap.get(name.toLowerCase()) || null,
    }));
  }

  const recentSongs = songs.slice(0, 10);

  return { totalSongs: songs.length, artistStats, recentSongs };
}

export default function ExploreTab() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["explore-user-data", user?.id],
    queryFn: () => fetchUserExploreData(user!.id),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { totalSongs = 0, artistStats = [], recentSongs = [] } = data || {};

  if (totalSongs === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Disc3 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          O seu universo musical está a nascer
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Importe a sua primeira música para ver os seus artistas e estatísticas aparecerem aqui!
        </p>
        <Button onClick={() => navigate("/songs")} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Música
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {artistStats.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4">🎤 Top Artistas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {artistStats.map((a) => (
              <button
                key={a.name}
                onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
              >
                {a.photo_url ? (
                  <img
                    src={a.photo_url}
                    alt={a.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Music2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="text-sm font-medium text-foreground truncate w-full text-center">
                  {a.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.count} {a.count === 1 ? "música" : "músicas"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">🏆 Top 10 Recentes</h2>
        <div className="space-y-1">
          {recentSongs.map((song: any, i: number) => (
            <button
              key={song.id}
              onClick={() => navigate(`/songs/${song.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                {song.artist && (
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
