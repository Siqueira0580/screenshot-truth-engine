import { BadgeCheck, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DeezerTrack } from "@/hooks/useTopCharts";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface HeroCarouselProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
}

export default function HeroCarousel({ tracks }: HeroCarouselProps) {
  const heroTracks = tracks.slice(0, 4);
  const mainTrack = heroTracks[0];
  const secondaryTracks = heroTracks.slice(1, 4);
  const navigate = useNavigate();

  const goToArtist = (track: DeezerTrack) => {
    navigate(`/artist/${encodeURIComponent(track.artist.name)}`, {
      state: { photoUrl: track.artist.picture_xl || track.artist.picture_medium },
    });
  };

  if (!mainTrack) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
        🔥 Destaques
      </h2>

      {/* Main Hero */}
      <div
        className="relative w-full overflow-hidden cursor-pointer group"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 95%)" }}
        onClick={() => goToArtist(mainTrack)}
      >
        <div className="relative h-[280px] md:h-[340px]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-card to-accent/20 dark:from-cyan-900/90 dark:via-slate-900 dark:to-fuchsia-900/80" />

          <div className="absolute right-0 bottom-0 h-full w-[55%] md:w-[45%]">
            <img
              src={mainTrack.artist.picture_xl || mainTrack.artist.picture_medium}
              alt={mainTrack.artist.name}
              className="h-full w-full object-cover object-top opacity-80 group-hover:scale-105 transition-transform duration-500"
              style={{ maskImage: "linear-gradient(to left, black 50%, transparent 100%)" }}
              loading="lazy"
            />
          </div>

          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-transparent to-accent" />
          <div className="absolute bottom-0 left-0 w-[60%] h-[2px] bg-gradient-to-r from-primary to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <span className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-2">
              Música em Alta
            </span>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl md:text-4xl font-black text-foreground truncate">
                {mainTrack.title}
              </h3>
              <BadgeCheck className="h-5 w-5 md:h-6 md:w-6 shrink-0 text-primary" />
            </div>
            <p className="text-sm md:text-base text-muted-foreground mb-2">{mainTrack.artist.name}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary/80 transition-colors">
              <Compass className="h-3.5 w-3.5" /> Explorar
            </span>
          </div>
        </div>
      </div>

      {/* Secondary cards */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {secondaryTracks.map((track) => (
            <div
              key={track.id}
              className="shrink-0 w-[200px] md:w-[240px] relative cursor-pointer group overflow-hidden"
              style={{ clipPath: "polygon(0 0, 95% 0, 100% 20%, 100% 100%, 5% 100%, 0 85%)" }}
              onClick={() => goToArtist(track)}
            >
              <div className="relative h-[140px] md:h-[160px]">
                <img
                  src={track.artist.picture_xl || track.artist.picture_medium}
                  alt={track.artist.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/60 to-accent/60" />

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-sm font-bold text-foreground truncate">{track.title}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">{track.artist.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
