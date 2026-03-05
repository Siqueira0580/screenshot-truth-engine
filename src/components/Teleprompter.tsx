import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Play, Pause, Minus, Plus, SkipForward, SkipBack, Maximize, ChevronUp, ChevronDown } from "lucide-react";
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
  autoHideControls?: boolean;
}

function makeChordClickable(text: string) {
  return text.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g,
    '<span class="chord chord-clickable" data-chord="$1">$1</span>'
  );
}

const NEAR_END_THRESHOLD = 0.80; // 80% scrolled = near end

export default function Teleprompter({ songs, initialIndex = 0, open, onClose, autoHideControls = true }: TeleprompterProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [fontSize, setFontSize] = useState(28);
  const [showControls, setShowControls] = useState(true);
  const [transpose, setTranspose] = useState(0);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [chordModalOpen, setChordModalOpen] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const [songProgress, setSongProgress] = useState(0);
  const [loopsRemaining, setLoopsRemaining] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTime = useRef<number>(0);
  const songRefs = useRef<(HTMLDivElement | null)[]>([]);
  const repeatingRef = useRef(false);

  // Initialize loops remaining from song config
  useEffect(() => {
    setLoopsRemaining(songs.map(s => s.loop_count ?? 0));
  }, [songs]);

  const song = songs[currentIndex];
  const displayKey = transposeKey(song?.musical_key, transpose);

  // Build all songs' display bodies
  const displayBodies = useMemo(() =>
    songs.map(s => s.body_text ? transposeText(s.body_text, transpose) : null),
    [songs, transpose]
  );

  // Track current song based on scroll position
  // Handle loop repeat - scroll back to song start
  const handleSongRepeat = useCallback((songIndex: number) => {
    if (repeatingRef.current) return; // prevent multiple triggers
    repeatingRef.current = true;
    
    const el = songRefs.current[songIndex];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
    }
    setLoopsRemaining(prev => {
      const next = [...prev];
      next[songIndex] = Math.max(0, (next[songIndex] || 0) - 1);
      return next;
    });
    setNearEnd(false);
    
    // Allow auto-scroll to resume after scroll-back completes
    setTimeout(() => {
      repeatingRef.current = false;
    }, 1500);
  }, []);

  const updateCurrentSong = useCallback(() => {
    if (!scrollRef.current || songRefs.current.length === 0) return;

    const container = scrollRef.current;
    const scrollTop = container.scrollTop;
    const viewportMiddle = scrollTop + container.clientHeight / 3;

    for (let i = songRefs.current.length - 1; i >= 0; i--) {
      const el = songRefs.current[i];
      if (el && el.offsetTop <= viewportMiddle) {
        if (i !== currentIndex) {
          setCurrentIndex(i);
        }
        break;
      }
    }

    // Check if near end of current song section
    const currentEl = songRefs.current[currentIndex];
    const nextEl = songRefs.current[currentIndex + 1];
    if (currentEl && nextEl) {
      const songBottom = nextEl.offsetTop;
      const distanceToEnd = songBottom - (scrollTop + container.clientHeight);
      const songHeight = nextEl.offsetTop - currentEl.offsetTop;
      const progress = 1 - (distanceToEnd / songHeight);
      const clampedProgress = Math.max(0, Math.min(1, progress));
      setSongProgress(clampedProgress);
      setNearEnd(progress >= NEAR_END_THRESHOLD);

      // If reached end and has loops remaining, repeat
      if (progress >= 0.98 && (loopsRemaining[currentIndex] || 0) > 0) {
        handleSongRepeat(currentIndex);
      }
    } else if (currentEl && !nextEl) {
      // Last song
      const el = container;
      const remaining = el.scrollHeight - (scrollTop + el.clientHeight);
      const totalHeight = el.scrollHeight - el.clientHeight;
      const progress = totalHeight > 0 ? 1 - (remaining / totalHeight) : 0;
      const clampedProgress = Math.max(0, Math.min(1, progress));
      setSongProgress(clampedProgress);
      const atEnd = progress >= NEAR_END_THRESHOLD;
      setNearEnd(atEnd);

      // If reached end and has loops remaining, repeat
      if (progress >= 0.98 && (loopsRemaining[currentIndex] || 0) > 0) {
        handleSongRepeat(currentIndex);
      }
    }
  }, [currentIndex, loopsRemaining, handleSongRepeat]);

  // Navigate to a specific song by scrolling to it
  const navigateTo = useCallback((index: number) => {
    const el = songRefs.current[index];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;

    const step = (timestamp: number) => {
      if (!lastTime.current) lastTime.current = timestamp;
      const delta = timestamp - lastTime.current;
      lastTime.current = timestamp;

      if (scrollRef.current && !repeatingRef.current) {
        const pxPerMs = speed * 0.03;
        scrollRef.current.scrollTop += pxPerMs * delta;
        updateCurrentSong();

        const el = scrollRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
          setIsPlaying(false);
        }
      }
      animRef.current = requestAnimationFrame(step);
    };

    lastTime.current = 0;
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speed, updateCurrentSong]);

  // Track scroll position on manual scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateCurrentSong();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateCurrentSong]);

  // Scroll to initial song on open
  useEffect(() => {
    if (open && initialIndex > 0) {
      setTimeout(() => navigateTo(initialIndex), 100);
    }
  }, [open, initialIndex, navigateTo]);

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
    if (autoHideControls) {
      controlsTimer.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 5000);
    }
  }, [isPlaying, autoHideControls]);

  useEffect(() => {
    if (!isPlaying || !autoHideControls) setShowControls(true);
  }, [isPlaying, autoHideControls]);

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
    const chordEl = target.closest?.(".chord-clickable") as HTMLElement | null;
    if (chordEl) {
      const chord = chordEl.getAttribute("data-chord");
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
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-foreground shrink-0">
          <Maximize className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 w-full bg-muted/20 shrink-0">
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-150 rounded-r-full",
            songProgress >= NEAR_END_THRESHOLD
              ? "bg-gradient-to-r from-primary to-amber-400 shadow-[0_0_8px_hsl(40_90%_55%/0.5)]"
              : "bg-primary"
          )}
          style={{ width: `${(songProgress * 100).toFixed(1)}%` }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground leading-none">
          {Math.round(songProgress * 100)}%
        </span>
      </div>

      {/* Song navigation HUD */}
      <SongNavigationHUD
        songs={songs}
        currentIndex={currentIndex}
        transpose={transpose}
        visible={showControls}
        nearEnd={nearEnd}
        remainingLoops={loopsRemaining[currentIndex] || 0}
        onNavigate={navigateTo}
      />

      {/* Continuous scroll area with all songs */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 py-12"
        style={{ scrollBehavior: "auto" }}
        onClick={handleBodyClick}
      >
        {songs.map((s, idx) => {
          const body = displayBodies[idx];
          const sKey = transposeKey(s.musical_key, transpose);
          return (
            <div
              key={idx}
              ref={(el) => { songRefs.current[idx] = el; }}
            >
              {/* Song divider (not for first song) */}
              {idx > 0 && (
                <div className="flex items-center gap-4 my-12">
                  <div className="h-px flex-1 bg-primary/30" />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                    <span className="text-xs font-mono text-primary font-semibold uppercase tracking-wider">
                      {idx + 1}/{songs.length}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-primary/30" />
                </div>
              )}

              {/* Song header */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h3
                    className="text-2xl font-bold text-foreground font-display"
                    style={{ fontSize: `${Math.max(fontSize + 4, 20)}px` }}
                  >
                    {s.title}
                  </h3>
                  {(loopsRemaining[idx] || 0) > 0 && (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono border",
                      idx === currentIndex && nearEnd
                        ? "bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse-alert"
                        : "bg-primary/10 border-primary/40 text-primary"
                    )}>
                      🔁 {loopsRemaining[idx]}x
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {s.artist}
                  {sKey && ` · Tom: ${sKey}`}
                  {s.bpm && ` · ${s.bpm} BPM`}
                </p>
              </div>

              {/* Song body */}
              {body ? (
                <pre
                  className="chord-text whitespace-pre-wrap leading-relaxed text-foreground mx-auto max-w-4xl"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.8,
                  }}
                  dangerouslySetInnerHTML={{ __html: makeChordClickable(body) }}
                />
              ) : (
                <p className="text-center text-muted-foreground text-xl my-12">
                  Nenhuma cifra disponível
                </p>
              )}
            </div>
          );
        })}
        {/* Extra space at the bottom for scrolling */}
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
