import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Music2 } from "lucide-react";
import type { DeezerTrack } from "@/hooks/useTopCharts";

interface HeroCarouselProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
}

export default function HeroCarousel({ tracks, onAddSong }: HeroCarouselProps) {
  const heroTracks = tracks.slice(0, 6);

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">🔥 Destaques</h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {heroTracks.map((track) => (
            <div
              key={track.id}
              className="group relative shrink-0 w-[260px] h-[160px] rounded-xl overflow-hidden cursor-pointer"
              onClick={() => onAddSong(track)}
            >
              <img
                src={track.artist.picture_xl || track.artist.picture_medium}
                alt={track.artist.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-base font-bold truncate">{track.title}</p>
                <p className="text-xs opacity-80 truncate">{track.artist.name}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSong(track);
                  }}
                >
                  <Music2 className="h-3 w-3" />
                  Aprender a tocar
                </Button>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
