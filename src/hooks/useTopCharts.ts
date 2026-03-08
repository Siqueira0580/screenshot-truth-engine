import { useQuery } from "@tanstack/react-query";

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
  // Use a CORS proxy since Deezer API doesn't allow browser requests
  const res = await fetch("https://corsproxy.io/?https://api.deezer.com/chart/0/tracks?limit=20");
  if (!res.ok) throw new Error("Falha ao carregar top charts");
  const json = await res.json();
  return json.data ?? [];
}

export function useTopCharts() {
  return useQuery({
    queryKey: ["deezer-top-charts"],
    queryFn: fetchTopCharts,
    staleTime: 1000 * 60 * 30, // 30 min
    retry: 1,
  });
}
