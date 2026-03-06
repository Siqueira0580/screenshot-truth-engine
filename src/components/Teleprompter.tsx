import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Play, Pause, Minus, Plus, SkipForward, SkipBack, Maximize, ChevronUp, ChevronDown, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { transposeText, transposeKey } from "@/lib/transpose";

const ALL_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
import MetronomePulse from "@/components/teleprompter/MetronomePulse";

import ChordModal from "@/components/teleprompter/ChordModal";
import SongChordsFAB from "@/components/SongChordsFAB";

interface TeleprompterSong {
  title: string;
  artist?: string | null;
  artist_photo_url?: string | null;
  musical_key?: string | null;
  bpm?: number | null;
  body_text?: string | null;
  loop_count?: number | null;
  auto_next?: boolean | null;
  speed?: number | null; // percentage value e.g. 250 = 2.5x
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
  const [speed, setSpeed] = useState(() => {
    const initial = songs[initialIndex]?.speed;
    return initial ? initial / 100 : 2;
  });
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

  // Update speed when current song changes (use song's configured speed)
  useEffect(() => {
    const songSpeed = songs[currentIndex]?.speed;
    if (songSpeed) {
      setSpeed(songSpeed / 100);
    }
  }, [currentIndex, songs]);

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
          setSpeed((s) => Math.min(s + 0.1, 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed((s) => Math.max(s - 0.1, 0.5));
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
      {/* Top bar - 3 columns: prev | current | next */}
      {(() => {
        const prev = currentIndex > 0 ? songs[currentIndex - 1] : null;
        const next = currentIndex < songs.length - 1 ? songs[currentIndex + 1] : null;
        return (
          <>
          <div
            className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-3 py-2 gap-1 md:gap-2"
            style={{ background: "hsl(220 20% 4% / 0.9)" }}
          >
            {/* Left: close + prev (prev hidden on mobile) */}
            <div className="flex items-center gap-2 min-w-0 w-full md:w-auto">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground shrink-0 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>

              {/* Current song info - visible on mobile in this row */}
              <div className="flex items-center gap-2 min-w-0 flex-1 md:hidden">
                {song.artist_photo_url && (
                  <Avatar className="h-8 w-8 shrink-0 border-2 border-primary/40">
                    <AvatarImage src={song.artist_photo_url} alt={song.artist || ""} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {(song.artist || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-foreground truncate">{song.title}</h2>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {song.artist}
                    {displayKey && ` · ${displayKey}`}
                    {songs.length > 1 && ` · ${currentIndex + 1}/${songs.length}`}
                  </p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-full border-2 font-mono font-black text-[10px] shrink-0 transition-all cursor-pointer",
                      (loopsRemaining[currentIndex] || 0) > 0
                        ? nearEnd
                          ? "bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse-alert"
                          : "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/20 border-border text-muted-foreground"
                    )}>
                      <Repeat className="h-3 w-3" />
                      {(loopsRemaining[currentIndex] || 0) > 0 ? `${loopsRemaining[currentIndex]}x` : "—"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1.5 z-[200]" align="center" side="bottom">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(n => (
                        <button
                          key={n}
                          onClick={() => setLoopsRemaining(prevLoops => {
                            const updated = [...prevLoops];
                            updated[currentIndex] = n;
                            return updated;
                          })}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-bold font-mono transition-colors",
                            (loopsRemaining[currentIndex] || 0) === n
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/30 text-foreground hover:bg-muted"
                          )}
                        >
                          {n === 0 ? "Nenhum" : `${n}x`}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-foreground shrink-0 h-8 w-8 md:hidden">
                <Maximize className="h-4 w-4" />
              </Button>

              {/* Previous song - hidden on mobile */}
              {prev ? (
                <button
                  onClick={() => navigateTo(currentIndex - 1)}
                  className="hidden md:flex items-center gap-1.5 text-left rounded-lg bg-muted/20 border border-border px-2.5 py-1.5 hover:border-primary/40 transition-all min-w-0"
                >
                  <SkipBack className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold leading-none mb-0.5">Anterior</p>
                    {prev.artist && <p className="text-[10px] text-muted-foreground truncate leading-tight">{prev.artist}</p>}
                    <p className="text-xs font-bold text-foreground truncate leading-tight">{prev.title}</p>
                    {prev.musical_key && (
                      <p className="text-[10px] text-primary font-mono font-semibold leading-tight">
                        Tom: {transposeKey(prev.musical_key, transpose)}
                      </p>
                    )}
                  </div>
                </button>
              ) : <div className="hidden md:block" />}
            </div>

            {/* Center: current song - hidden on mobile */}
            <div className="hidden md:flex items-center gap-2.5 min-w-0 max-w-md">
              {song.artist_photo_url ? (
                <Avatar className="h-9 w-9 shrink-0 border-2 border-primary/40">
                  <AvatarImage src={song.artist_photo_url} alt={song.artist || ""} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {(song.artist || "?")[0]}
                  </AvatarFallback>
                </Avatar>
              ) : song.artist ? (
                <Avatar className="h-9 w-9 shrink-0 border-2 border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {song.artist[0]}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <div className="min-w-0 text-center">
                <h2 className="text-base font-bold text-foreground truncate">{song.title}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist}
                  {displayKey && ` · Tom: ${displayKey}`}
                  {song.bpm && ` · ${song.bpm} BPM`}
                  {songs.length > 1 && ` · ${currentIndex + 1}/${songs.length}`}
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full border-2 font-mono font-black text-xs shrink-0 transition-all cursor-pointer",
                    (loopsRemaining[currentIndex] || 0) > 0
                      ? nearEnd
                        ? "bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse-alert shadow-[0_0_16px_hsl(40_95%_55%/0.4)]"
                        : "bg-primary/10 border-primary/40 text-primary"
                      : "bg-muted/20 border-border text-muted-foreground hover:border-primary/40"
                  )}>
                    <Repeat className="h-3.5 w-3.5" />
                    {(loopsRemaining[currentIndex] || 0) > 0 ? `${loopsRemaining[currentIndex]}x` : "—"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1.5 z-[200]" align="center" side="bottom">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => setLoopsRemaining(prevLoops => {
                          const updated = [...prevLoops];
                          updated[currentIndex] = n;
                          return updated;
                        })}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-bold font-mono transition-colors",
                          (loopsRemaining[currentIndex] || 0) === n
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-foreground hover:bg-muted"
                        )}
                      >
                        {n === 0 ? "Nenhum" : `${n}x`}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Right: next + fullscreen - hidden on mobile */}
            <div className="hidden md:flex items-center justify-end gap-2 min-w-0">
              {next ? (
                <button
                  onClick={() => navigateTo(currentIndex + 1)}
                  className={cn(
                    "flex items-center gap-1.5 text-right rounded-lg border px-2.5 py-1.5 transition-all min-w-0",
                    nearEnd && loopsRemaining[currentIndex] <= 0
                      ? "bg-primary/20 border-primary animate-pulse-alert shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                      : "bg-muted/20 border-border hover:border-primary/40"
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn(
                      "text-[10px] uppercase tracking-wider font-semibold leading-none mb-0.5",
                      nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary" : "text-muted-foreground"
                    )}>Próxima</p>
                    {next.artist && <p className="text-[10px] text-muted-foreground truncate leading-tight">{next.artist}</p>}
                    <p className={cn(
                      "text-xs font-bold truncate leading-tight",
                      nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary" : "text-foreground"
                    )}>{next.title}</p>
                    {next.musical_key && (
                      <p className={cn(
                        "font-mono font-black text-[11px] leading-tight",
                        nearEnd && loopsRemaining[currentIndex] <= 0 ? "animate-key-blink" : "text-primary"
                      )}>
                        Tom: {transposeKey(next.musical_key, transpose)}
                      </p>
                    )}
                  </div>
                  <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ) : <div />}
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-foreground shrink-0 h-8 w-8">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile: fixed bottom-of-header next-song banner */}
          {next && (
            <button
              onClick={() => navigateTo(currentIndex + 1)}
              className={cn(
                "md:hidden w-full flex items-center justify-between px-3 py-1.5 transition-all",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none",
                nearEnd && loopsRemaining[currentIndex] <= 0
                  ? "bg-primary/15"
                  : "bg-muted/5"
              )}
              style={{ background: nearEnd && loopsRemaining[currentIndex] <= 0 ? undefined : "hsl(220 20% 6% / 0.8)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <SkipForward className={cn(
                  "h-3 w-3 shrink-0",
                  nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-semibold shrink-0",
                  nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary" : "text-muted-foreground"
                )}>Próxima:</span>
                <span className={cn(
                  "text-xs font-bold truncate",
                  nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary" : "text-foreground"
                )}>{next.title}</span>
              </div>
              {next.musical_key && (
                <span className={cn(
                  "text-xs font-mono font-black shrink-0 ml-2",
                  nearEnd && loopsRemaining[currentIndex] <= 0 ? "text-primary animate-key-blink" : "text-primary"
                )}>
                  {transposeKey(next.musical_key, transpose)}
                </span>
              )}
            </button>
          )}
          </>
        );
      })()}

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
        <div className="flex items-center gap-2 min-w-[180px]">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Vel</span>
          <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={5} step={0.1} className="w-28" />
          <span className="text-xs text-foreground font-mono w-10">{speed.toFixed(1)}x</span>
        </div>

        {/* Metronome */}
        <MetronomePulse bpm={song.bpm ?? 0} isPlaying={isPlaying} />

        {/* Transpose */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setTranspose((t) => t - 1)} className="text-foreground h-8 w-8">
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold font-mono border transition-colors",
                  transpose !== 0
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted/30 border-border text-foreground"
                )}
                title="Clique para escolher a tonalidade"
              >
                {displayKey || "—"}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2 z-[200]"
              side="top"
              align="center"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 text-center">
                Tonalidade
              </p>
              <div className="grid grid-cols-4 gap-1">
                {ALL_KEYS.map((key) => {
                  // Calculate semitones needed to reach this key from original
                  const originalKey = song?.musical_key;
                  if (!originalKey) return null;
                  const origMatch = originalKey.match(/^([A-G][#b]?)(.*)/);
                  if (!origMatch) return null;
                  const origRoot = origMatch[1];
                  const suffix = origMatch[2];
                  const origIdx = ALL_KEYS.indexOf(origRoot) !== -1
                    ? ALL_KEYS.indexOf(origRoot)
                    : ALL_KEYS.findIndex(k => k === origRoot || (origRoot === "Db" && k === "C#") || (origRoot === "D#" && k === "Eb") || (origRoot === "Gb" && k === "F#") || (origRoot === "G#" && k === "Ab") || (origRoot === "A#" && k === "Bb"));
                  const targetIdx = ALL_KEYS.indexOf(key);
                  const semitones = ((targetIdx - origIdx) % 12 + 12) % 12;
                  const isActive = displayKey === `${key}${suffix}`;

                  return (
                    <button
                      key={key}
                      onClick={() => setTranspose(semitones === 0 ? 0 : semitones)}
                      className={cn(
                        "px-2 py-1.5 rounded text-xs font-mono font-bold transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {key}{suffix}
                    </button>
                  );
                })}
              </div>
              {!song?.musical_key && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Sem tom definido
                </p>
              )}
            </PopoverContent>
          </Popover>
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
      <SongChordsFAB bodyText={displayBodies[currentIndex]} className="z-[110]" />
    </div>
  );
}
