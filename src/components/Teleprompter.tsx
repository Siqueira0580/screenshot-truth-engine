import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, Minus, Plus, SkipForward, SkipBack, Maximize, ChevronUp, ChevronDown, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { transposeText, transposeKey } from "@/lib/transpose";
import MetronomePulse from "@/components/teleprompter/MetronomePulse";
import SongNavigationHUD from "@/components/teleprompter/SongNavigationHUD";
import ChordModal from "@/components/teleprompter/ChordModal";

interface TeleprompterSong {
  title: string;
  artist?: string | null;
  musical_key?: string | null;
  bpm?: number | null;
  body_text?: string | null;
  loop_count?: number | null;
  auto_next?: boolean | null;
}

interface TeleprompterProps {
  songs: TeleprompterSong[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

function makeChordClickable(text: string) {
  return text.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g,
    '<span class="chord chord-clickable" data-chord="$1">$1</span>'
  );
}

export default function Teleprompter({ songs, initialIndex = 0, open, onClose }: TeleprompterProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [fontSize, setFontSize] = useState(28);
  const [showControls, setShowControls] = useState(true);
  const [transpose, setTranspose] = useState(0);
  const [loopsRemaining, setLoopsRemaining] = useState(0);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [chordModalOpen, setChordModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTime = useRef<number>(0);

  const song = songs[currentIndex];
  const displayKey = transposeKey(song?.musical_key, transpose);
  const displayBody = song?.body_text ? transposeText(song.body_text, transpose) : null;

  // Init loops when song changes
  useEffect(() => {
    setLoopsRemaining(song?.loop_count ?? 0);
  }, [currentIndex, song?.loop_count]);

  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
    resetScroll();
  }, [resetScroll]);

  // Auto-scroll with loop + auto-next
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;

    const step = (timestamp: number) => {
      if (!lastTime.current) lastTime.current = timestamp;
      const delta = timestamp - lastTime.current;
      lastTime.current = timestamp;

      if (scrollRef.current) {
        const pxPerMs = speed * 0.03;
        scrollRef.current.scrollTop += pxPerMs * delta;

        const el = scrollRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
          // End reached
          if (loopsRemaining > 0) {
            // Loop: restart scroll
            setLoopsRemaining((l) => l - 1);
            resetScroll();
          } else if (song?.auto_next !== false && currentIndex < songs.length - 1) {
            // Auto-next
            navigateTo(currentIndex + 1);
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
  }, [isPlaying, speed, currentIndex, songs.length, resetScroll, loopsRemaining, song?.auto_next, navigateTo]);

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
          if (currentIndex < songs.length - 1) navigateTo(currentIndex + 1);
          break;
        case "ArrowLeft":
          if (currentIndex > 0) navigateTo(currentIndex - 1);
          break;
        case "+":
        case "=":
          setTranspose((t) => t + 1);
          break;
        case "-":
          setTranspose((t) => t - 1);
          break;
        case "0":
          setTranspose(0);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, currentIndex, songs.length, navigateTo]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 5000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
  }, [isPlaying]);

  // Fullscreen on play
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    if (isPlaying && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [open]);

  // Chord click handler
  const handleBodyClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("chord-clickable")) {
      const chord = target.getAttribute("data-chord");
      if (chord) {
        setSelectedChord(chord);
        setChordModalOpen(true);
      }
    }
  }, []);

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
              {displayKey && ` · Tom: ${displayKey}`}
              {song.bpm && ` · ${song.bpm} BPM`}
              {songs.length > 1 && ` · ${currentIndex + 1}/${songs.length}`}
              {transpose !== 0 && ` · Transposto: ${transpose > 0 ? "+" : ""}${transpose}`}
              {loopsRemaining > 0 && ` · ${loopsRemaining}x restante`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-foreground shrink-0">
          <Maximize className="h-5 w-5" />
        </Button>
      </div>

      {/* Song navigation HUD */}
      <SongNavigationHUD
        songs={songs}
        currentIndex={currentIndex}
        transpose={transpose}
        visible={showControls}
        onNavigate={navigateTo}
      />

      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 py-12"
        style={{ scrollBehavior: "auto" }}
        onClick={handleBodyClick}
      >
        {displayBody ? (
          <pre
            className="chord-text whitespace-pre-wrap leading-relaxed text-foreground mx-auto max-w-4xl"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: `${fontSize}px`,
              lineHeight: 1.8,
            }}
            dangerouslySetInnerHTML={{ __html: makeChordClickable(displayBody) }}
          />
        ) : (
          <p className="text-center text-muted-foreground text-2xl mt-24">
            Nenhuma cifra disponível
          </p>
        )}
        {loopsRemaining > 0 && (
          <div className="flex items-center justify-center gap-3 my-8 text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-mono flex items-center gap-1">
              <Repeat className="h-3 w-3" /> REPETIÇÃO ({loopsRemaining}x)
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
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
        {/* Nav buttons */}
        {songs.length > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={currentIndex === 0} onClick={() => navigateTo(currentIndex - 1)} className="text-foreground">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={currentIndex === songs.length - 1} onClick={() => navigateTo(currentIndex + 1)} className="text-foreground">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Play/Pause */}
        <Button variant="default" size="icon" onClick={() => setIsPlaying((p) => !p)} className="h-12 w-12 rounded-full">
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        {/* Speed */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Velocidade</span>
          <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={10} step={0.5} className="w-24" />
          <span className="text-xs text-foreground font-mono w-8">{speed}x</span>
        </div>

        {/* Metronome */}
        <MetronomePulse bpm={song.bpm ?? 0} isPlaying={isPlaying} />

        {/* Transpose */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setTranspose((t) => t - 1)} className="text-foreground h-8 w-8">
            <ChevronDown className="h-3 w-3" />
          </Button>
          <span className="text-xs text-foreground font-mono w-8 text-center">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setTranspose((t) => t + 1)} className="text-foreground h-8 w-8">
            <ChevronUp className="h-3 w-3" />
          </Button>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setFontSize((s) => Math.max(s - 2, 14))} className="text-foreground h-8 w-8">
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs text-foreground font-mono w-8 text-center">{fontSize}</span>
          <Button variant="ghost" size="icon" onClick={() => setFontSize((s) => Math.min(s + 2, 60))} className="text-foreground h-8 w-8">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chord modal */}
      <ChordModal
        chord={selectedChord}
        open={chordModalOpen}
        onClose={() => setChordModalOpen(false)}
      />
    </div>
  );
}
