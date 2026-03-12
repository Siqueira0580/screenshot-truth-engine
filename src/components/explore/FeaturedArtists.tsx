import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import type { DeezerTrack } from "@/hooks/useTopCharts";

interface FeaturedArtistsProps {
  tracks: DeezerTrack[];
  title?: string;
}

export default function FeaturedArtists({ tracks, title = "🎤 Artistas em Destaque" }: FeaturedArtistsProps) {
  const navigate = useNavigate();
  const seen = new Set<number>();
  const artists = tracks
    .filter((t) => {
      if (seen.has(t.artist.id)) return false;
      seen.add(t.artist.id);
      return true;
    })
    .slice(0, 8);

  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-4">
        {title}
      </h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4 px-1">
          {artists.map((track) => (
            <div
              key={track.artist.id}
              className="shrink-0 w-[130px] md:w-[150px] group cursor-pointer"
              onClick={() => navigate(`/artist/${encodeURIComponent(track.artist.name)}`, { state: { photoUrl: track.artist.picture_xl || track.artist.picture_medium } })}
            >
              <div
                className="relative w-full aspect-[3/4] overflow-hidden mb-2"
                style={{
                  clipPath: "polygon(15% 0, 85% 0, 100% 10%, 100% 80%, 85% 100%, 15% 100%, 0 80%, 0 10%)",
                }}
              >
                <img
                  src={track.artist.picture_xl || track.artist.picture_medium}
                  alt={track.artist.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    clipPath: "polygon(15% 0, 85% 0, 100% 10%, 100% 80%, 85% 100%, 15% 100%, 0 80%, 0 10%)",
                    boxShadow: "inset 0 0 20px hsl(var(--primary) / 0.3), inset 0 0 20px hsl(var(--accent) / 0.2)",
                  }}
                />
              </div>
              <p className="text-center text-sm font-semibold text-foreground truncate px-1 group-hover:text-primary transition-colors">
                {track.artist.name}
              </p>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
