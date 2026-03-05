import { cn } from "@/lib/utils";
import { transposeKey } from "@/lib/transpose";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Song {
  title: string;
  musical_key?: string | null;
}

interface SongNavigationHUDProps {
  songs: Song[];
  currentIndex: number;
  transpose: number;
  visible: boolean;
  nearEnd: boolean;
  onNavigate: (index: number) => void;
}

export default function SongNavigationHUD({
  songs,
  currentIndex,
  transpose,
  visible,
  nearEnd,
  onNavigate,
}: SongNavigationHUDProps) {
  if (songs.length <= 1) return null;

  const prev = currentIndex > 0 ? songs[currentIndex - 1] : null;
  const next = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;

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

      {/* Next */}
      <div className="pointer-events-auto max-w-[180px]">
        {next && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className={cn(
              "flex items-center gap-2 text-right rounded-xl backdrop-blur-md border-2 p-3 transition-all shadow-lg",
              nearEnd
                ? "bg-primary/20 border-primary animate-pulse-alert shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
                : "bg-card/90 border-border hover:border-primary/60"
            )}
          >
            <div className="min-w-0">
              <p className={cn(
                "text-[11px] uppercase tracking-wider font-semibold",
                nearEnd ? "text-primary" : "text-muted-foreground"
              )}>
                Próxima
              </p>
              <p className={cn(
                "text-sm font-bold truncate",
                nearEnd ? "text-primary-foreground" : "text-foreground"
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
              nearEnd ? "text-primary" : "text-muted-foreground"
            )} />
          </button>
        )}
      </div>
    </div>
  );
}
