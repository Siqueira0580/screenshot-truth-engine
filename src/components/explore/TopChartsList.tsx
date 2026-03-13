import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BadgeCheck, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DeezerTrack } from "@/hooks/useTopCharts";

interface TopChartsListProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
  title?: string;
}

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

export default function TopChartsList({ tracks, title = "🏆 Top 10 Global" }: TopChartsListProps) {
  const topTen = tracks.slice(0, 10);
  const navigate = useNavigate();

  const handleExplore = (track: DeezerTrack) => {
    navigate(`/artist/${encodeURIComponent(track.artist.name)}`, {
      state: { photoUrl: track.artist.picture_xl || track.artist.picture_medium },
    });
  };

  return (
    <div className="relative">
      <h2 className="text-lg font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-6">
        {title}
      </h2>

      <div className="absolute left-8 md:left-16 top-16 bottom-0 w-[2px] opacity-20 bg-gradient-to-b from-primary via-accent to-primary" />

      <div className="space-y-3 relative">
        {topTen.map((track, i) => {
          const offset = FLOW_OFFSETS[i] || { ml: "ml-0" };
          return (
            <button
              key={track.id}
              onClick={() => handleExplore(track)}
              className={`${offset.ml} flex items-center gap-3 w-fit max-w-full pr-4 transition-all duration-300 hover:scale-[1.02] group relative`}
            >
              <div
                className="shrink-0 w-10 h-10 flex items-center justify-center text-sm font-black text-primary-foreground relative"
                style={{
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  background: i === 0
                    ? "var(--gradient-warm)"
                    : i < 3
                      ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))"
                      : "linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--muted)))",
                }}
              >
                {i + 1}
              </div>

              <div
                className="flex items-center gap-3 py-2.5 px-4 pr-6 border-none ring-0 rounded-lg group-hover:shadow-[var(--shadow-glow)] transition-all duration-300"
                style={{ clipPath: "polygon(0 0, 98% 0, 100% 40%, 97% 100%, 2% 100%, 0 70%)", background: "var(--gradient-card-list)", boxShadow: "var(--shadow-card)" }}
              >
              >
                <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                  <AvatarImage src={track.artist.picture_medium} alt={track.artist.name} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground">{track.artist.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-foreground truncate max-w-[160px] md:max-w-[260px]">
                      {track.title}
                    </span>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground truncate block max-w-[160px] md:max-w-[260px]">
                    {track.artist.name}
                  </span>
                </div>
                <Compass className="h-4 w-4 text-primary/50 group-hover:text-primary ml-2 shrink-0 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
