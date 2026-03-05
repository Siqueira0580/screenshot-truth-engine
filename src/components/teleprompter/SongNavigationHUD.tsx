import { cn } from "@/lib/utils";
import { transposeKey } from "@/lib/transpose";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";

interface Song {
  title: string;
  musical_key?: string | null;
  loop_count?: number | null;
}

interface SongNavigationHUDProps {
  songs: Song[];
  currentIndex: number;
  transpose: number;
  visible: boolean;
  nearEnd: boolean;
  remainingLoops: number;
  onNavigate: (index: number) => void;
}

export default function SongNavigationHUD({
  songs,
  currentIndex,
  transpose,
  visible,
  nearEnd,
  remainingLoops,
  onNavigate,
}: SongNavigationHUDProps) {
  if (songs.length <= 1 && remainingLoops <= 0) return null;

  const prev = currentIndex > 0 ? songs[currentIndex - 1] : null;
  const next = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;
  const willRepeat = remainingLoops > 0;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-3 pointer-events-none z-[101] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Previous */}
      <div className="pointer-events-auto max-w-[180px]">
        {prev && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="flex items-center gap-2 text-left rounded-xl bg-card/90 backdrop-blur-md border-2 border-border p-3 hover:border-primary/60 transition-all shadow-lg"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Anterior</p>
              <p className="text-sm font-bold text-foreground truncate">{prev.title}</p>
              {prev.musical_key && (
                <p className="text-xs text-primary font-mono font-semibold">
                  {transposeKey(prev.musical_key, transpose)}
                </p>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Right side: Loop indicator or Next */}
      <div className="pointer-events-auto max-w-[200px] flex flex-col items-end gap-2">
        {/* Loop/Repeat indicator */}
        {willRepeat && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl backdrop-blur-md border-2 p-3 transition-all shadow-lg",
              nearEnd
                ? "bg-amber-500/20 border-amber-400 animate-pulse-alert shadow-[0_0_24px_hsl(40_95%_55%/0.5)]"
                : "bg-card/90 border-primary/40"
            )}
          >
            <Repeat className={cn(
              "h-5 w-5 shrink-0",
              nearEnd ? "text-amber-400" : "text-primary"
            )} />
            <div className="min-w-0 text-right">
              <p className={cn(
                "text-[11px] uppercase tracking-wider font-semibold",
                nearEnd ? "text-amber-400" : "text-muted-foreground"
              )}>
                Repetir
              </p>
              <p className={cn(
                "text-lg font-black font-mono",
                nearEnd ? "text-amber-300" : "text-foreground"
              )}>
                {remainingLoops}x
              </p>
            </div>
          </div>
        )}

        {/* Next song */}
        {next && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className={cn(
              "flex items-center gap-2 text-right rounded-xl backdrop-blur-md border-2 p-3 transition-all shadow-lg",
              nearEnd && !willRepeat
                ? "bg-primary/20 border-primary animate-pulse-alert shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
                : "bg-card/90 border-border hover:border-primary/60"
            )}
          >
            <div className="min-w-0">
              <p className={cn(
                "text-[11px] uppercase tracking-wider font-semibold",
                nearEnd && !willRepeat ? "text-primary" : "text-muted-foreground"
              )}>
                {willRepeat ? "Depois" : "Próxima"}
              </p>
              <p className={cn(
                "text-sm font-bold truncate",
                nearEnd && !willRepeat ? "text-primary-foreground" : "text-foreground"
              )}>
                {next.title}
              </p>
              {next.musical_key && (
                <p className="text-xs text-primary font-mono font-semibold">
                  {transposeKey(next.musical_key, transpose)}
                </p>
              )}
            </div>
            <ChevronRight className={cn(
              "h-5 w-5 shrink-0",
              nearEnd && !willRepeat ? "text-primary" : "text-muted-foreground"
            )} />
          </button>
        )}
      </div>
    </div>
  );
}
