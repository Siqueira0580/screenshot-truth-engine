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

async function fetchTopCharts(): Promise<DeezerTrack[]> {
  const { data, error } = await supabase.functions.invoke("deezer-charts");
  if (error) throw error;
  return data?.data ?? [];
}

export function useTopCharts() {
  return useQuery({
    queryKey: ["deezer-top-charts"],
    queryFn: fetchTopCharts,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
