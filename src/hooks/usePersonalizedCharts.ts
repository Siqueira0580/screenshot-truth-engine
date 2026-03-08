import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import type { DeezerTrack } from "@/hooks/useTopCharts";

async function fetchPersonalizedTracks(artistNames: string[]): Promise<DeezerTrack[]> {
  if (artistNames.length === 0) {
    const { data, error } = await supabase.functions.invoke("deezer-charts", {
      body: { genre: "Todos" },
    });
    if (error) throw error;
    return data?.data ?? [];
  }

  const { data, error } = await supabase.functions.invoke("deezer-charts", {
    body: { action: "personalized-tracks", artists: artistNames },
  });
  if (error) throw error;
  return data?.data ?? [];
}

export function usePersonalizedCharts() {
  const { favoriteArtists, wizardCompleted } = useUserPreferences();
  const artistNames = favoriteArtists.map((a) => a.name);
  const isPersonalized = wizardCompleted && artistNames.length > 0;

  const query = useQuery({
    queryKey: ["personalized-charts", isPersonalized ? artistNames.join(",") : "global"],
    queryFn: () => fetchPersonalizedTracks(isPersonalized ? artistNames : []),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return { ...query, isPersonalized, favoriteArtists };
}
