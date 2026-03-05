import { cn } from "@/lib/utils";
import { transposeKey } from "@/lib/transpose";

interface Song {
  title: string;
  musical_key?: string | null;
}

interface SongNavigationHUDProps {
  songs: Song[];
  currentIndex: number;
  transpose: number;
  visible: boolean;
  onNavigate: (index: number) => void;
}

export default function SongNavigationHUD({
  songs,
  currentIndex,
  transpose,
  visible,
  onNavigate,
}: SongNavigationHUDProps) {
  if (songs.length <= 1) return null;

  const prev = currentIndex > 0 ? songs[currentIndex - 1] : null;
  const next = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none z-[101] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Previous */}
      <div className="pointer-events-auto max-w-[140px]">
        {prev && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="text-left rounded-lg bg-card/80 backdrop-blur-sm border border-border p-2 hover:border-primary/40 transition-colors"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Anterior</p>
            <p className="text-xs font-medium text-foreground truncate">{prev.title}</p>
            {prev.musical_key && (
              <p className="text-[10px] text-primary font-mono">
                {transposeKey(prev.musical_key, transpose)}
              </p>
            )}
          </button>
        )}
      </div>

      {/* Next */}
      <div className="pointer-events-auto max-w-[140px]">
        {next && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="text-right rounded-lg bg-card/80 backdrop-blur-sm border border-border p-2 hover:border-primary/40 transition-colors"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Próxima</p>
            <p className="text-xs font-medium text-foreground truncate">{next.title}</p>
            {next.musical_key && (
              <p className="text-[10px] text-primary font-mono">
                {transposeKey(next.musical_key, transpose)}
              </p>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
