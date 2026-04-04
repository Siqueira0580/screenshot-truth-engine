import { useState, useCallback, useRef, useEffect } from "react";
import YouTube, { type YouTubeEvent } from "react-youtube";
import ChordText from "@/components/ChordText";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlayCircle, ArrowDown, Pause, Music2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PlaylistSong {
  title: string;
  artist?: string | null;
  body_text?: string | null;
}

interface YouTubePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  youtubeIds: string[];
  playlistSongs: PlaylistSong[];
}

export default function YouTubePlaylistModal({
  open,
  onOpenChange,
  youtubeIds,
  playlistSongs,
}: YouTubePlaylistModalProps) {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const playerRef = useRef<any>(null);

  const currentSong = playlistSongs[currentIndex] ?? null;

  // Track playlist index via YouTube IFrame API
  const handleStateChange = useCallback(
    (event: YouTubeEvent) => {
      const player = event.target;
      if (!player?.getPlaylistIndex) return;
      const idx = player.getPlaylistIndex();
      if (typeof idx === "number" && idx >= 0) {
        setCurrentIndex(idx);
      }
    },
    [],
  );

  const handleReady = useCallback((event: YouTubeEvent) => {
    playerRef.current = event.target;
  }, []);

  // Auto-scroll lyrics
  useEffect(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = undefined;
    }
    if (autoScroll && lyricsRef.current) {
      scrollIntervalRef.current = setInterval(() => {
        lyricsRef.current?.scrollBy({ top: 1, behavior: "auto" });
      }, 60);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [autoScroll, currentIndex]);

  // Reset scroll position when song changes
  useEffect(() => {
    if (lyricsRef.current) {
      lyricsRef.current.scrollTop = 0;
    }
    setAutoScroll(false);
  }, [currentIndex]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setAutoScroll(false);
    }
  }, [open]);

  if (youtubeIds.length === 0) return null;

  const opts: any = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      rel: 0,
      loop: 0,
      playlist: youtubeIds.join(","),
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden gap-0",
          isMobile
            ? "w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh]"
            : "w-[90vw] max-w-6xl h-[85vh] max-h-[85vh]",
        )}
      >
        <DialogHeader className="p-3 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-primary" />
            Playlist do Repertório
            <span className="text-xs text-muted-foreground font-normal ml-auto">
              {currentIndex + 1}/{youtubeIds.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "flex flex-1 min-h-0 overflow-hidden",
            isMobile ? "flex-col" : "flex-row",
          )}
        >
          {/* Side A — Video */}
          <div
            className={cn(
              "bg-black flex-shrink-0",
              isMobile ? "w-full aspect-video" : "w-1/2",
            )}
          >
            {open && (
              <YouTube
                videoId={youtubeIds[0]}
                opts={opts}
                onStateChange={handleStateChange}
                onReady={handleReady}
                className="w-full h-full"
                iframeClassName="w-full h-full"
              />
            )}
          </div>

          {/* Side B — Lyrics / Chords */}
          <div
            className={cn(
              "flex flex-col min-h-0",
              isMobile ? "flex-1" : "w-1/2",
            )}
          >
            {/* Song header + auto-scroll toggle */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 shrink-0">
              <Music2 className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {currentSong?.title ?? "—"}
                </p>
                {currentSong?.artist && (
                  <p className="text-xs text-muted-foreground truncate">
                    {currentSong.artist}
                  </p>
                )}
              </div>
              <Button
                variant={autoScroll ? "default" : "outline"}
                size="sm"
                className="gap-1.5 shrink-0 text-xs h-7"
                onClick={() => setAutoScroll((v) => !v)}
              >
                {autoScroll ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                Auto-Scroll
              </Button>
            </div>

            {/* Lyrics body */}
            <div
              ref={lyricsRef}
              className="flex-1 overflow-y-auto p-4"
            >
              {currentSong?.body_text ? (
                <pre className="whitespace-pre-wrap font-mono text-sm sm:text-base leading-relaxed text-foreground">
                  {currentSong.body_text}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Music2 className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Nenhuma cifra disponível para esta música.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
