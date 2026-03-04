import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, Minus, Plus, SkipForward, SkipBack, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface TeleprompterSong {
  title: string;
  artist?: string | null;
  musical_key?: string | null;
  bpm?: number | null;
  body_text?: string | null;
}

interface TeleprompterProps {
  songs: TeleprompterSong[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

function highlightChords(text: string) {
  return text.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g,
    '<span class="chord">$1</span>'
  );
}

export default function Teleprompter({ songs, initialIndex = 0, open, onClose }: TeleprompterProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // px per frame tick
  const [fontSize, setFontSize] = useState(28);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTime = useRef<number>(0);

  const song = songs[currentIndex];

  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;

    const step = (timestamp: number) => {
      if (!lastTime.current) lastTime.current = timestamp;
      const delta = timestamp - lastTime.current;
      lastTime.current = timestamp;

      if (scrollRef.current) {
        const pxPerMs = speed * 0.03; // speed factor
        scrollRef.current.scrollTop += pxPerMs * delta;

        // Auto-advance to next song when reaching the bottom
        const el = scrollRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
          if (currentIndex < songs.length - 1) {
            setCurrentIndex((i) => i + 1);
            resetScroll();
          } else {
            setIsPlaying(false);
          }
        }
      }
      animRef.current = requestAnimationFrame(step);
    };

    lastTime.current = 0;
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speed, currentIndex, songs.length, resetScroll]);

  // Reset scroll on song change
  useEffect(() => {
    resetScroll();
  }, [currentIndex, resetScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case "Escape":
          onClose();
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed((s) => Math.min(s + 0.5, 10));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed((s) => Math.max(s - 0.5, 0.5));
          break;
        case "ArrowRight":
          if (currentIndex < songs.length - 1) {
            setCurrentIndex((i) => i + 1);
            resetScroll();
          }
          break;
        case "ArrowLeft":
          if (currentIndex > 0) {
            setCurrentIndex((i) => i - 1);
            resetScroll();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, currentIndex, songs.length, resetScroll]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
  }, [isPlaying]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [open]);

  if (!open || !song) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "hsl(220 20% 4%)" }}
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Top bar */}
      <div
        className={cn(
          "flex items-center justify-between px-6 py-3 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "hsl(220 20% 4% / 0.9)" }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground shrink-0">
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{song.title}</h2>
            <p className="text-sm text-muted-foreground truncate">
              {song.artist}
              {song.musical_key && ` · Tom: ${song.musical_key}`}
              {song.bpm && ` · ${song.bpm} BPM`}
              {songs.length > 1 && ` · ${currentIndex + 1}/${songs.length}`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-foreground shrink-0">
          <Maximize className="h-5 w-5" />
        </Button>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 py-12"
        style={{ scrollBehavior: "auto" }}
      >
        {song.body_text ? (
          <pre
            className="chord-text whitespace-pre-wrap leading-relaxed text-foreground mx-auto max-w-4xl"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: `${fontSize}px`,
              lineHeight: 1.8,
            }}
            dangerouslySetInnerHTML={{ __html: highlightChords(song.body_text) }}
          />
        ) : (
          <p className="text-center text-muted-foreground text-2xl mt-24">
            Nenhuma cifra disponível
          </p>
        )}
        {/* Extra padding so auto-scroll can reach the end */}
        <div className="h-[80vh]" />
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-4 px-6 py-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "hsl(220 20% 4% / 0.9)" }}
      >
        {/* Navigation */}
        {songs.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentIndex === 0}
              onClick={() => { setCurrentIndex((i) => i - 1); resetScroll(); }}
              className="text-foreground"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentIndex === songs.length - 1}
              onClick={() => { setCurrentIndex((i) => i + 1); resetScroll(); }}
              className="text-foreground"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Play/Pause */}
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsPlaying((p) => !p)}
          className="h-12 w-12 rounded-full"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        {/* Speed */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Velocidade</span>
          <Slider
            value={[speed]}
            onValueChange={([v]) => setSpeed(v)}
            min={0.5}
            max={10}
            step={0.5}
            className="w-24"
          />
          <span className="text-xs text-foreground font-mono w-8">{speed}x</span>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFontSize((s) => Math.max(s - 2, 14))}
            className="text-foreground h-8 w-8"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs text-foreground font-mono w-8 text-center">{fontSize}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFontSize((s) => Math.min(s + 2, 60))}
            className="text-foreground h-8 w-8"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
