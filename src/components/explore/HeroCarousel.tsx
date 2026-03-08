import { BadgeCheck, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DeezerTrack } from "@/hooks/useTopCharts";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface HeroCarouselProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
}

export default function HeroCarousel({ tracks, onAddSong }: HeroCarouselProps) {
  const heroTracks = tracks.slice(0, 4);
  const mainTrack = heroTracks[0];
  const secondaryTracks = heroTracks.slice(1, 4);

  if (!mainTrack) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
        🔥 Destaques
      </h2>

      {/* Main Hero - Large Asymmetric Shape */}
      <div
        className="relative w-full overflow-hidden cursor-pointer group"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 95%)" }}
        onClick={() => onAddSong(mainTrack)}
      >
        <div className="relative h-[280px] md:h-[340px]">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/90 via-slate-900 to-fuchsia-900/80" />

          {/* Artist image - positioned as cut-out */}
          <div className="absolute right-0 bottom-0 h-full w-[55%] md:w-[45%]">
            <img
              src={mainTrack.artist.picture_xl || mainTrack.artist.picture_medium}
              alt={mainTrack.artist.name}
              className="h-full w-full object-cover object-top opacity-80 group-hover:scale-105 transition-transform duration-500"
              style={{ maskImage: "linear-gradient(to left, black 50%, transparent 100%)" }}
              loading="lazy"
            />
          </div>

          {/* Neon accent lines */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-transparent to-fuchsia-500" />
          <div className="absolute bottom-0 left-0 w-[60%] h-[2px] bg-gradient-to-r from-cyan-400 to-transparent" />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <span className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-semibold mb-2">
              Música em Alta
            </span>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl md:text-4xl font-black text-white truncate">
                {mainTrack.title}
              </h3>
              <BadgeCheck className="h-5 w-5 md:h-6 md:w-6 shrink-0 text-cyan-400" />
            </div>
            <p className="text-sm md:text-base text-slate-300 mb-4">{mainTrack.artist.name}</p>

          </div>
        </div>
      </div>

      {/* Secondary cards - smaller asymmetric */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {secondaryTracks.map((track) => (
            <div
              key={track.id}
              className="shrink-0 w-[200px] md:w-[240px] relative cursor-pointer group overflow-hidden"
              style={{ clipPath: "polygon(0 0, 95% 0, 100% 20%, 100% 100%, 5% 100%, 0 85%)" }}
              onClick={() => onAddSong(track)}
            >
              <div className="relative h-[140px] md:h-[160px]">
                <img
                  src={track.artist.picture_xl || track.artist.picture_medium}
                  alt={track.artist.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

                {/* Neon border accent */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-400/60 to-fuchsia-500/60" />

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-sm font-bold text-white truncate">{track.title}</span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  </div>
                  <span className="text-xs text-slate-400 truncate block">{track.artist.name}</span>
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
