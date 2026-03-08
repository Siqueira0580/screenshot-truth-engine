import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Play, Pause, Square, Music2, Mic2, Drum, Piano,
  Volume2, ChevronUp, ChevronDown, Loader2,
  ArrowLeft, Minus, Plus, BookOpen, Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { fetchSong, fetchArtists } from "@/lib/supabase-queries";
import { MultitrackEngine, StemType } from "@/lib/audio-engine";
import { transposeText, transposeKey } from "@/lib/transpose";
import { cn } from "@/lib/utils";
import { parseChordsInText } from "@/lib/chord-parser";
import { isChordProFormat } from "@/lib/chordpro-parser";
import { useChordProParser } from "@/hooks/useChordProParser";
import ChordModal from "@/components/teleprompter/ChordModal";
import { useIsMobile } from "@/hooks/use-mobile";
import SongChordsFAB from "@/components/SongChordsFAB";

const ALL_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

interface AudioTrack {
  id: string;
  song_id: string;
  file_full: string | null;
  file_vocals: string | null;
  file_percussion: string | null;
  file_harmony: string | null;
}

const STEM_DISPLAY: { type: StemType; label: string; icon: typeof Music2; color: string }[] = [
  { type: "full", label: "Mix", icon: Music2, color: "text-primary" },
  { type: "vocals", label: "Voz", icon: Mic2, color: "text-blue-400" },
  { type: "percussion", label: "Perc", icon: Drum, color: "text-orange-400" },
  { type: "harmony", label: "Harm", icon: Piano, color: "text-emerald-400" },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ChordPro renderer — chords stacked above lyrics
function ChordProRenderedText({
  text, fontSize, onChordClick,
}: { text: string; fontSize: number; onChordClick: (chord: string) => void }) {
  const { lines } = useChordProParser(text);

  return (
    <div className="font-mono leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
      {lines.map((line, lineIdx) => {
        const firstToken = line.tokens[0];
        if (firstToken && !firstToken.chord && /^\s*\{[^}]+\}\s*$/.test(firstToken.lyric)) {
          return null;
        }

        return (
          <div key={lineIdx} className="flex flex-wrap items-end mb-1">
            {line.tokens.map((token, tokenIdx) => (
              <span key={tokenIdx} className="inline-flex flex-col mr-0.5">
                <span className="font-bold text-[0.75em] h-[1.4em] leading-[1.4em] select-none text-primary">
                  {token.chord ? (
                    <span
                      className="cursor-pointer hover:text-accent transition-colors underline decoration-primary/30 underline-offset-2"
                      onClick={() => onChordClick(token.chord!)}
                    >
                      {token.chord}
                    </span>
                  ) : (
                    "\u00A0"
                  )}
                </span>
                <span className="text-foreground whitespace-pre">
                  {token.lyric || "\u00A0"}
                </span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Inline chord rendering for plain text
function InlineChordText({
  text, fontSize, onChordClick,
}: { text: string; fontSize: number; onChordClick: (chord: string) => void }) {
  const lines = text.split("\n");

  return (
    <pre className="whitespace-pre-wrap font-mono leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
      {lines.map((line, lineIdx) => {
        const segments = parseChordsInText(line);
        return (
          <span key={lineIdx}>
            {segments.map((seg, segIdx) =>
              seg.type === "chord" ? (
                <span
                  key={segIdx}
                  className="text-primary font-bold cursor-pointer hover:text-accent transition-colors"
                  onClick={() => onChordClick(seg.content)}
                >
                  {seg.content}
                </span>
              ) : (
                <span key={segIdx}>{seg.content}</span>
              )
            )}
            {lineIdx < lines.length - 1 && "\n"}
          </span>
        );
      })}
    </pre>
  );
}

// Auto-detects ChordPro vs plain text
function ChordHighlightedText({
  text, fontSize, onChordClick,
}: { text: string; fontSize: number; onChordClick: (chord: string) => void }) {
  const isChordPro = useMemo(() => isChordProFormat(text), [text]);

  if (isChordPro) {
    return <ChordProRenderedText text={text} fontSize={fontSize} onChordClick={onChordClick} />;
  }
  return <InlineChordText text={text} fontSize={fontSize} onChordClick={onChordClick} />;
}

export default function StudyPage() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const engineRef = useRef<MultitrackEngine | null>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const scrollAnimRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [stemVols, setStemVols] = useState<Record<StemType, number>>({ full: 100, vocals: 100, percussion: 100, harmony: 100 });
  const [mutedStems, setMutedStems] = useState<Record<StemType, boolean>>({ full: false, vocals: false, percussion: false, harmony: false });
  const [soloStems, setSoloStems] = useState<Record<StemType, boolean>>({ full: false, vocals: false, percussion: false, harmony: false });
  const [transpose, setTranspose] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [isScrolling, setIsScrolling] = useState(false);
  const [fontSize, setFontSize] = useState(22);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [chordModalOpen, setChordModalOpen] = useState(false);
  const [showMixer, setShowMixer] = useState(false);

  const { data: song } = useQuery({ queryKey: ["song", songId], queryFn: () => fetchSong(songId!), enabled: !!songId });
  const { data: artists = [] } = useQuery({ queryKey: ["artists"], queryFn: fetchArtists });
  const { data: audioTrack } = useQuery({
    queryKey: ["audio_track", songId],
    queryFn: async () => {
      if (!songId) return null;
      const { data } = await supabase.from("audio_tracks").select("*").eq("song_id", songId).maybeSingle();
      return data as AudioTrack | null;
    },
    enabled: !!songId,
  });

  const displayKey = transposeKey(song?.musical_key, transpose);
  const displayBody = useMemo(
    () => song?.body_text ? transposeText(song.body_text, transpose) : null,
    [song?.body_text, transpose]
  );

  const artistPhoto = song?.artist
    ? artists.find(a => a.name.toLowerCase() === song.artist!.toLowerCase())?.photo_url
    : null;

  const hasAnyStem = audioTrack && (audioTrack.file_full || audioTrack.file_vocals || audioTrack.file_percussion || audioTrack.file_harmony);

  // Initialize audio engine
  useEffect(() => {
    const engine = new MultitrackEngine();
    engineRef.current = engine;
    engine.setCallbacks({
      onTimeUpdate: (t, d) => { setCurrentTime(t); setDuration(d); },
      onPlayStateChange: setIsPlaying,
      onLoadStateChange: setLoading,
    });
    return () => engine.dispose();
  }, []);

  // Load stems
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !audioTrack) return;
    engine.stop();
    const loadStems = async () => {
      const stemMap: Record<StemType, string | null> = {
        full: audioTrack.file_full, vocals: audioTrack.file_vocals,
        percussion: audioTrack.file_percussion, harmony: audioTrack.file_harmony,
      };
      for (const [type, url] of Object.entries(stemMap)) {
        if (url) {
          try { await engine.loadStem(type as StemType, url); }
          catch (e) { console.error(`Failed to load ${type}:`, e); }
        }
      }
    };
    loadStems();
  }, [audioTrack]);

  useEffect(() => { engineRef.current?.setMasterVolume(masterVol / 100); }, [masterVol]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const [type, vol] of Object.entries(stemVols)) {
      const st = type as StemType;
      const isMuted = mutedStems[st];
      const anySoloed = Object.values(soloStems).some(Boolean);
      const shouldPlay = anySoloed ? soloStems[st] && !isMuted : !isMuted;
      engine.setStemVolume(st, shouldPlay ? vol / 100 : 0);
    }
  }, [stemVols, mutedStems, soloStems]);

  useEffect(() => { engineRef.current?.setPitch(transpose); }, [transpose]);

  // Auto-scroll
  useEffect(() => {
    if (!isScrolling || !lyricsRef.current) return;
    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      if (lyricsRef.current) {
        const pxPerMs = scrollSpeed * 0.03;
        lyricsRef.current.scrollTop += pxPerMs * delta;
        const el = lyricsRef.current;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setIsScrolling(false);
      }
      scrollAnimRef.current = requestAnimationFrame(step);
    };
    lastTimeRef.current = 0;
    scrollAnimRef.current = requestAnimationFrame(step);
    return () => { if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current); };
  }, [isScrolling, scrollSpeed]);

  const handlePlay = () => { engineRef.current?.play(); setIsScrolling(true); };
  const handlePause = () => { engineRef.current?.pause(); setIsScrolling(false); };
  const handleStop = () => { engineRef.current?.stop(); setIsScrolling(false); if (lyricsRef.current) lyricsRef.current.scrollTop = 0; };
  const handleSeek = (val: number[]) => engineRef.current?.seek(val[0]);

  const handleChordClick = useCallback((chord: string) => {
    setSelectedChord(chord);
    setChordModalOpen(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": e.preventDefault(); if (isPlaying) handlePause(); else handlePlay(); break;
        case "+": case "=": setTranspose(t => t + 1); break;
        case "-": setTranspose(t => t - 1); break;
        case "0": setTranspose(0); break;
        case "ArrowUp": e.preventDefault(); setScrollSpeed(s => Math.min(s + 0.2, 5)); break;
        case "ArrowDown": e.preventDefault(); setScrollSpeed(s => Math.max(s - 0.2, 0.5)); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying]);

  if (!songId) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {artistPhoto ? (
            <img src={artistPhoto} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{song?.title || "Carregando..."}</h1>
            <p className="text-xs text-muted-foreground truncate">{song?.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {displayKey && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-mono font-bold text-primary hover:bg-primary/20 transition-colors">
                  {displayKey}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="grid grid-cols-4 gap-1">
                  {ALL_KEYS.map(k => {
                    const original = song?.musical_key?.replace("m", "").replace("#", "#") || "";
                    const originalIdx = ALL_KEYS.indexOf(original) !== -1 ? ALL_KEYS.indexOf(original) : 0;
                    const targetIdx = ALL_KEYS.indexOf(k);
                    const semitones = ((targetIdx - originalIdx) % 12 + 12) % 12;
                    const isMinor = song?.musical_key?.endsWith("m");
                    return (
                      <button key={k} onClick={() => setTranspose(semitones === 0 ? 0 : semitones)}
                        className={cn("px-2 py-1.5 text-xs font-mono font-bold rounded transition-colors",
                          transpose !== 0 && displayKey?.replace("m", "") === k ? "bg-primary text-primary-foreground"
                          : semitones === 0 ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                        )}>
                        {k}{isMinor ? "m" : ""}
                      </button>
                    );
                  })}
                </div>
                {transpose !== 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-7" onClick={() => setTranspose(0)}>
                    Voltar ao original ({song?.musical_key})
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
          {song?.bpm && (
            <span className="rounded-lg bg-accent/50 px-3 py-1.5 text-sm font-mono font-bold text-accent-foreground">
              {song.bpm} <span className="text-[10px] text-muted-foreground">BPM</span>
            </span>
          )}
          {/* Mobile mixer toggle */}
          {hasAnyStem && isMobile && (
            <Button variant="outline" size="sm" onClick={() => setShowMixer(v => !v)} className="gap-1">
              <Music2 className="h-3.5 w-3.5" />
              Mixer
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Lyrics panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-b border-border text-xs">
            <span className="text-muted-foreground font-medium">Rolagem:</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScrollSpeed(s => Math.max(s - 0.2, 0.5))}><Minus className="h-3 w-3" /></Button>
            <span className="font-mono w-8 text-center">{scrollSpeed.toFixed(1)}x</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setScrollSpeed(s => Math.min(s + 0.2, 5))}><Plus className="h-3 w-3" /></Button>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-muted-foreground font-medium">Fonte:</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.max(s - 2, 14))}><Minus className="h-3 w-3" /></Button>
            <span className="font-mono w-6 text-center">{fontSize}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.min(s + 2, 40))}><Plus className="h-3 w-3" /></Button>
          </div>

          <div ref={lyricsRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {displayBody ? (
              <ChordHighlightedText text={displayBody} fontSize={fontSize} onChordClick={handleChordClick} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Esta música não tem letra/cifra cadastrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Audio controls sidebar / mobile drawer */}
        {hasAnyStem && (!isMobile || showMixer) && (
          <div className={cn(
            "border-border bg-card flex flex-col shrink-0",
            isMobile
              ? "fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto border-t rounded-t-2xl shadow-2xl"
              : "w-72 border-l"
          )}>
            {/* Mobile close handle */}
            {isMobile && (
              <button onClick={() => setShowMixer(false)} className="flex justify-center py-2">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </button>
            )}

            {/* Transport */}
            <div className="p-3 border-b border-border space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-8 sm:w-8" onClick={handleStop}><Square className="h-3.5 w-3.5" /></Button>
                <Button size="icon" onClick={isPlaying ? handlePause : handlePlay} disabled={loading} className="h-14 w-14 sm:h-12 sm:w-12 rounded-full">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                </Button>
              </div>
              <div className="space-y-1">
                <Slider value={[currentTime]} max={duration || 1} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            {/* Transposition */}
            <div className="p-3 border-b border-border space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transposição</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTranspose(t => t - 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                <span className="font-mono text-sm font-semibold w-10 text-center">{transpose > 0 ? `+${transpose}` : transpose}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTranspose(t => t + 1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                {transpose !== 0 && <Button variant="ghost" size="sm" className="text-xs h-7 ml-auto" onClick={() => setTranspose(0)}>Reset</Button>}
              </div>
              {song?.musical_key && transpose !== 0 && (
                <p className="text-[10px] text-muted-foreground">{song.musical_key} → {displayKey}</p>
              )}
            </div>

            {/* Master volume */}
            <div className="p-3 border-b border-border space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Volume2 className="h-3 w-3" /> Volume
              </label>
              <Slider value={[masterVol]} max={100} step={1} onValueChange={v => setMasterVol(v[0])} />
            </div>

            {/* Stem mixer */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mixer</h3>
                {(Object.values(mutedStems).some(Boolean) || Object.values(soloStems).some(Boolean)) && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => {
                    setMutedStems({ full: false, vocals: false, percussion: false, harmony: false });
                    setSoloStems({ full: false, vocals: false, percussion: false, harmony: false });
                  }}>Reset</Button>
                )}
              </div>
              {STEM_DISPLAY.map(({ type, label, icon: Icon, color }) => {
                const colMap: Record<StemType, keyof AudioTrack> = {
                  full: "file_full", vocals: "file_vocals", percussion: "file_percussion", harmony: "file_harmony",
                };
                const hasFile = audioTrack && audioTrack[colMap[type]];
                if (!hasFile) return null;

                const isMutedStem = mutedStems[type];
                const isSoloed = soloStems[type];
                const anySoloed = Object.values(soloStems).some(Boolean);
                const isEffectivelyMuted = anySoloed ? !isSoloed || isMutedStem : isMutedStem;

                return (
                  <div key={type} className={cn(
                    "rounded-lg border p-2.5 sm:p-2.5 space-y-2 transition-all",
                    isEffectivelyMuted ? "border-border bg-muted/30 opacity-50" : "border-border bg-secondary/30",
                    isSoloed && "border-primary/50 bg-primary/5 opacity-100 ring-1 ring-primary/20"
                  )}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", color)} />
                      <span className="text-sm sm:text-xs font-medium flex-1">{label}</span>
                      <div className="flex gap-1.5 sm:gap-1">
                        <button
                          className={cn(
                            "h-7 w-7 sm:h-5 sm:w-5 rounded text-xs sm:text-[9px] font-black flex items-center justify-center transition-colors",
                            isMutedStem ? "bg-destructive text-destructive-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          )}
                          onClick={() => setMutedStems(prev => ({ ...prev, [type]: !prev[type] }))}
                        >M</button>
                        <button
                          className={cn(
                            "h-7 w-7 sm:h-5 sm:w-5 rounded text-xs sm:text-[9px] font-black flex items-center justify-center transition-colors",
                            isSoloed ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          )}
                          onClick={() => setSoloStems(prev => ({ ...prev, [type]: !prev[type] }))}
                        >S</button>
                      </div>
                    </div>
                    <Slider
                      value={[stemVols[type]]} max={100} step={1}
                      onValueChange={v => setStemVols(prev => ({ ...prev, [type]: v[0] }))}
                      disabled={isEffectivelyMuted}
                      className="py-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ChordModal chord={selectedChord} open={chordModalOpen} onClose={() => setChordModalOpen(false)} />
      <SongChordsFAB bodyText={displayBody} />
    </div>
  );
}
