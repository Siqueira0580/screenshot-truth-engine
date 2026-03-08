import { useState } from "react";
import { useTopCharts, type DeezerTrack } from "@/hooks/useTopCharts";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import CategoryPills from "./CategoryPills";
import HeroCarousel from "./HeroCarousel";
import TopChartsList from "./TopChartsList";
import { createSong, findOrCreateArtist } from "@/lib/supabase-queries";
import { useQueryClient } from "@tanstack/react-query";

export default function ExploreTab() {
  const [category, setCategory] = useState("Todos");
  const { data: tracks = [], isLoading, isError } = useTopCharts();
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
            // TODO: buscar cifra automaticamente
            console.log("TODO: buscar cifra para", track.title, track.artist.name);
          } catch (err) {
            toast.error("Erro ao adicionar música");
          }
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || tracks.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Não foi possível carregar os destaques. Tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CategoryPills selected={category} onSelect={setCategory} />
      <HeroCarousel tracks={tracks} onAddSong={handleAddSong} />
      <TopChartsList tracks={tracks} onAddSong={handleAddSong} />
    </div>
  );
}
