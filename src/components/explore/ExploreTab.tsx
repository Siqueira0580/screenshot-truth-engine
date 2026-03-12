import { useState } from "react";
import { usePersonalizedCharts } from "@/hooks/usePersonalizedCharts";
import { useTopCharts, type DeezerTrack } from "@/hooks/useTopCharts";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import CategoryPills from "./CategoryPills";
import HeroCarousel from "./HeroCarousel";
import TopChartsList from "./TopChartsList";
import FeaturedArtists from "./FeaturedArtists";
import { createSong, findOrCreateArtist } from "@/lib/supabase-queries";
import { useQueryClient } from "@tanstack/react-query";

export default function ExploreTab() {
  const [category, setCategory] = useState("Todos");
  const { data: personalizedTracks = [], isLoading: pLoading, isError: pError, isPersonalized, favoriteArtists } = usePersonalizedCharts();
  const { data: categoryTracks = [], isLoading: cLoading, isError: cError } = useTopCharts(category);
  const queryClient = useQueryClient();

  // When personalized and category is "Todos", use personalized data; otherwise use category filter
  const usePersonalized = isPersonalized && category === "Todos";
  const tracks = usePersonalized ? personalizedTracks : categoryTracks;
  const isLoading = usePersonalized ? pLoading : cLoading;
  const isError = usePersonalized ? pError : cError;

  // Build featured artists from user preferences when personalized
  const featuredArtistOverrides = usePersonalized
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

  return (
    <div className="space-y-8">
      <CategoryPills selected={category} onSelect={setCategory} />

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
            title={usePersonalized ? "🏆 O Seu Top 10" : "🏆 Top 10 Global"}
          />
          <FeaturedArtists
            tracks={featuredArtistOverrides || tracks}
            title={usePersonalized ? "🎤 Os Seus Artistas" : "🎤 Artistas em Destaque"}
          />
        </>
      )}
    </div>
  );
}
