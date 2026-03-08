import { useState } from "react";
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
  const { data: tracks = [], isLoading, isError } = useTopCharts(category);
  const queryClient = useQueryClient();

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
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : isError || tracks.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p>Não foi possível carregar os destaques. Tente novamente mais tarde.</p>
        </div>
      ) : (
        <>
          <HeroCarousel tracks={tracks} onAddSong={handleAddSong} />
          <TopChartsList tracks={tracks} onAddSong={handleAddSong} />
          <FeaturedArtists tracks={tracks} />
        </>
      )}
    </div>
  );
}
