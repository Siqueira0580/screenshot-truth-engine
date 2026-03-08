import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeezerTrack {
  id: number;
  title: string;
  artist: {
    id: number;
    name: string;
    picture_medium: string;
    picture_xl: string;
  };
  album: {
    cover_medium: string;
    cover_xl: string;
  };
}

async function fetchTopCharts(genre: string): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke("deezer-charts", {
    body: { genre },
  });
  if (error) throw error;
  return data?.data ?? [];
}

export function useTopCharts(genre: string = "Todos") {
  return useQuery({
    queryKey: ["deezer-top-charts", genre],
    queryFn: () => fetchTopCharts(genre),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
