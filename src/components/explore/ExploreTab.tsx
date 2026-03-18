import { useState, useEffect } from "react";
import { usePersonalizedCharts } from "@/hooks/usePersonalizedCharts";
import { useTopCharts, type DeezerTrack } from "@/hooks/useTopCharts";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import CategoryPills from "./CategoryPills";
import HeroCarousel from "./HeroCarousel";
import TopChartsList from "./TopChartsList";
import FeaturedArtists from "./FeaturedArtists";
import { createSong, findOrCreateArtist } from "@/lib/supabase-queries";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const GENRE_TO_CATEGORY: Record<string, string> = {
  todos: "Todos",
  pop: "Pop",
  rock: "Rock",
  sertanejo: "Sertanejo",
  worship: "Worship",
  samba: "Samba",
  pagode: "Pagode",
  mpb: "MPB",
  forro: "Forró",
  gospel: "Gospel",
  eletronica: "Eletrônica",
  reggae: "Reggae",
  funk: "Funk",
};

function useDefaultGenre() {
  return useQuery({
    queryKey: ["profile-default-genre"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "Todos";
      const { data } = await supabase
        .from("profiles")
        .select("default_genre")
        .eq("id", user.id)
        .single();
      const genre = data?.default_genre || "todos";
      return GENRE_TO_CATEGORY[genre] || "Todos";
    },
    staleTime: 1000 * 60 * 10,
  });
}

export default function ExploreTab() {
  const { data: defaultCategory, isLoading: genreLoading } = useDefaultGenre();
  const [category, setCategory] = useState<string | null>(null);

  // Set initial category once the default genre loads
  useEffect(() => {
    if (defaultCategory && category === null) {
      setCategory(defaultCategory);
    }
  }, [defaultCategory, category]);

  const activeCategory = category ?? "Todos";

  const { data: personalizedTracks = [], isLoading: pLoading, isError: pError, isPersonalized, favoriteArtists } = usePersonalizedCharts();
  const { data: categoryTracks = [], isLoading: cLoading, isError: cError } = useTopCharts(activeCategory);
  const queryClient = useQueryClient();

  const usePersonalized = isPersonalized && activeCategory === "Todos";
  const hasPersonalizedData = usePersonalized && personalizedTracks.length > 0 && !pError;
  const tracks = hasPersonalizedData ? personalizedTracks : categoryTracks;
  const isLoading = hasPersonalizedData ? pLoading : (usePersonalized ? (pLoading && cLoading) : cLoading);
  const isError = hasPersonalizedData ? false : (usePersonalized ? (pError && cError) : cError);

  const featuredArtistOverrides = hasPersonalizedData
    ? favoriteArtists.map((a, i) => ({
        id: Number(a.id) || 90000 + i,
        title: "",
        artist: {
          id: Number(a.id) || 90000 + i,
          name: a.name,
          picture_medium: a.imageUrl || "",
          picture_xl: a.imageUrl || "",
        },
        album: { cover_medium: "", cover_xl: "" },
      } as DeezerTrack))
    : null;

  const handleAddSong = (track: DeezerTrack) => {
    toast(`Deseja adicionar "${track.title}" de "${track.artist.name}" à sua biblioteca e buscar a cifra?`, {
      action: {
        label: "Adicionar",
        onClick: async () => {
          try {
            const { checkDuplicateSong } = await import("@/lib/supabase-queries");
            const duplicateId = await checkDuplicateSong(track.title, track.artist.name);
            if (duplicateId) {
              toast.error("Música já cadastrada! Você já possui uma música com este título e artista no seu repertório.");
              return;
            }
            await findOrCreateArtist(track.artist.name);
            await createSong({
              title: track.title,
              artist: track.artist.name,
            });
            queryClient.invalidateQueries({ queryKey: ["songs"] });
            toast.success(`"${track.title}" adicionada à biblioteca!`);
          } catch {
            toast.error("Erro ao adicionar música");
          }
        },
      },
    });
  };

  // Show skeleton while reading user's preferred genre to avoid category "flash"
  if (genreLoading || category === null) {
    return (
      <div className="space-y-8">
        <div className="flex gap-3 pb-2 px-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CategoryPills selected={activeCategory} onSelect={setCategory} defaultGenre={defaultCategory} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError || tracks.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>Não foi possível carregar os destaques. Tente novamente mais tarde.</p>
        </div>
      ) : (
        <>
          <HeroCarousel tracks={tracks} onAddSong={handleAddSong} />
          <TopChartsList
            tracks={tracks}
            onAddSong={handleAddSong}
            title={hasPersonalizedData ? "🏆 O Seu Top 10" : "🏆 Top 10 Global"}
          />
          <FeaturedArtists
            tracks={featuredArtistOverrides || tracks}
            title={hasPersonalizedData ? "🎤 Os Seus Artistas" : "🎤 Artistas em Destaque"}
          />
        </>
      )}
    </div>
  );
}
