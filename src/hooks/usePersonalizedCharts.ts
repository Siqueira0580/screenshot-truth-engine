import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DeezerTrack } from "@/hooks/useTopCharts";

const PREFS_KEY = "smartcifra_preferences";

interface Preferences {
  styles: string[];
  artists: { id: string; name: string; genre: string[]; imageUrl: string | null }[];
  skipped?: boolean;
}

function getPreferences(): Preferences | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.skipped || !parsed.artists?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchPersonalizedTracks(): Promise<DeezerTrack[]> {
  const prefs = getPreferences();
  if (!prefs) {
    // Fallback: global charts
    const { data, error } = await supabase.functions.invoke("deezer-charts", {
      body: { genre: "Todos" },
    });
    if (error) throw error;
    return data?.data ?? [];
  }

  const artistNames = prefs.artists.map((a) => a.name);
  const { data, error } = await supabase.functions.invoke("deezer-charts", {
    body: { action: "personalized-tracks", artists: artistNames },
  });
  if (error) throw error;
  return data?.data ?? [];
}

export function usePersonalizedCharts() {
  const prefs = getPreferences();
  const isPersonalized = !!prefs;
  const favoriteArtists = prefs?.artists ?? [];

  const query = useQuery({
    queryKey: ["personalized-charts", isPersonalized ? favoriteArtists.map((a) => a.name).join(",") : "global"],
    queryFn: fetchPersonalizedTracks,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return { ...query, isPersonalized, favoriteArtists };
}
