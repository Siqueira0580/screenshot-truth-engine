import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BadgeCheck } from "lucide-react";
import type { DeezerTrack } from "@/hooks/useTopCharts";

interface TopChartsListProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
  title?: string;
}

// Meandering offsets for the "rhythmic flow" path effect
const FLOW_OFFSETS = [
  { ml: "ml-0" },
  { ml: "ml-6 md:ml-10" },
  { ml: "ml-10 md:ml-20" },
  { ml: "ml-12 md:ml-28" },
  { ml: "ml-8 md:ml-22" },
  { ml: "ml-4 md:ml-14" },
  { ml: "ml-0" },
  { ml: "ml-6 md:ml-12" },
  { ml: "ml-12 md:ml-24" },
  { ml: "ml-8 md:ml-16" },
];

export default function TopChartsList({ tracks, onAddSong, title = "🏆 Top 10 Global" }: TopChartsListProps) {
  const topTen = tracks.slice(0, 10);

  return (
    <div className="relative">
      <h2 className="text-lg font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 mb-6">
        {title}
      </h2>

      {/* Flowing curved connector line (decorative SVG) */}
      <div className="absolute left-8 md:left-16 top-16 bottom-0 w-[2px] opacity-20"
        style={{ background: "linear-gradient(180deg, #06b6d4, #d946ef, #06b6d4)" }}
      />

      <div className="space-y-3 relative">
        {topTen.map((track, i) => {
          const offset = FLOW_OFFSETS[i] || { ml: "ml-0" };
          return (
            <button
              key={track.id}
              onClick={() => onAddSong(track)}
              className={`${offset.ml} flex items-center gap-3 w-fit max-w-full pr-4 transition-all duration-300 hover:scale-[1.02] group relative`}
            >
              {/* Rank diamond/polygon */}
              <div
                className="shrink-0 w-10 h-10 flex items-center justify-center text-sm font-black text-white relative"
                style={{
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: i === 0
                    ? "linear-gradient(135deg, #06b6d4, #d946ef)"
                    : i < 3
                      ? "linear-gradient(135deg, #0891b2, #7c3aed)"
                      : "linear-gradient(135deg, #1e293b, #334155)",
                }}
              >
                {i + 1}
              </div>

              {/* Card body - asymmetric shape */}
              <div
                className="flex items-center gap-3 py-2.5 px-4 pr-6 bg-slate-800/50 border border-cyan-500/10 group-hover:border-cyan-400/30 group-hover:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300"
                style={{ clipPath: "polygon(0 0, 98% 0, 100% 40%, 97% 100%, 2% 100%, 0 70%)" }}
              >
                <Avatar className="h-10 w-10 ring-2 ring-cyan-500/20 group-hover:ring-cyan-400/50 transition-all">
                  <AvatarImage src={track.artist.picture_medium} alt={track.artist.name} />
                  <AvatarFallback className="bg-slate-700 text-slate-300">{track.artist.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate max-w-[160px] md:max-w-[260px]">
                      {track.title}
                    </span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  </div>
                  <span className="text-xs text-slate-400 truncate block max-w-[160px] md:max-w-[260px]">
                    {track.artist.name}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
