import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BadgeCheck } from "lucide-react";
import type { DeezerTrack } from "@/hooks/useTopCharts";

interface TopChartsListProps {
  tracks: DeezerTrack[];
  onAddSong: (track: DeezerTrack) => void;
}

export default function TopChartsList({ tracks, onAddSong }: TopChartsListProps) {
  const topTen = tracks.slice(0, 10);

  return (
    <div>
      <h2 className="text-lg font-bold mb-3">🏆 Top Cifras</h2>
      <div className="grid gap-1">
        {topTen.map((track, i) => (
          <button
            key={track.id}
            onClick={() => onAddSong(track)}
            className="flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent/50 w-full"
          >
            <span className="w-6 text-right text-sm font-bold text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="h-9 w-9">
              <AvatarImage src={track.artist.picture_medium} alt={track.artist.name} />
              <AvatarFallback>{track.artist.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm truncate">{track.title}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground truncate block">
                {track.artist.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
