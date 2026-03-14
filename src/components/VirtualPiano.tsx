import { useState, useCallback, useRef, useEffect } from "react";
import { Piano, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ─── Note frequencies (C4 to C5) ─── */
const NOTES = [
  { note: "C4",  freq: 261.63, type: "white" as const },
  { note: "C#4", freq: 277.18, type: "black" as const },
  { note: "D4",  freq: 293.66, type: "white" as const },
  { note: "D#4", freq: 311.13, type: "black" as const },
  { note: "E4",  freq: 329.63, type: "white" as const },
  { note: "F4",  freq: 349.23, type: "white" as const },
  { note: "F#4", freq: 369.99, type: "black" as const },
  { note: "G4",  freq: 392.00, type: "white" as const },
  { note: "G#4", freq: 415.30, type: "black" as const },
  { note: "A4",  freq: 440.00, type: "white" as const },
  { note: "A#4", freq: 466.16, type: "black" as const },
  { note: "B4",  freq: 493.88, type: "white" as const },
  { note: "C5",  freq: 523.25, type: "white" as const },
];

const WHITE_NOTES = NOTES.filter((n) => n.type === "white");

// Map black keys to their position relative to white keys
const BLACK_KEY_POSITIONS: Record<string, number> = {
  "C#4": 0, // between C4(0) and D4(1)
  "D#4": 1, // between D4(1) and E4(2)
  "F#4": 3, // between F4(3) and G4(4)
  "G#4": 4, // between G4(4) and A4(5)
  "A#4": 5, // between A4(5) and B4(6)
};

const BLACK_NOTES = NOTES.filter((n) => n.type === "black");

export default function VirtualPiano() {
  const [expanded, setExpanded] = useState(false);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Lazy-init AudioContext
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const playNote = useCallback(
    (note: string, freq: number) => {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;

      // Oscillator — triangle for soft piano-like tone
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      // Second oscillator for richness (sine, detuned)
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(5, now);

      // Gain envelope (attack + release)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02); // fast attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // natural decay

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 1.3);
      osc2.stop(now + 1.3);

      // Visual feedback
      setActiveNotes((prev) => new Set(prev).add(note));
      setTimeout(() => {
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
      }, 200);
    },
    [getAudioCtx]
  );

  if (!expanded) {
    return (
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-30 flex justify-center pb-2 pointer-events-none">
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto gap-2 rounded-full shadow-lg border border-border bg-card"
          onClick={() => setExpanded(true)}
        >
          <Piano className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Piano</span>
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border shadow-[0_-4px_20px_hsl(var(--primary)/0.1)]">
      {/* Collapse bar */}
      <div className="flex items-center justify-center py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(false)}
        >
          <Piano className="h-3.5 w-3.5 text-primary" />
          Piano Virtual
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Keys container */}
      <div className="flex justify-center pb-3 px-2 overflow-x-auto">
        <div className="relative" style={{ width: `${WHITE_NOTES.length * 44}px`, height: "120px" }}>
          {/* White keys */}
          {WHITE_NOTES.map((n, i) => (
            <button
              key={n.note}
              onPointerDown={() => playNote(n.note, n.freq)}
              className={cn(
                "absolute top-0 border border-border rounded-b-lg transition-colors duration-100 select-none",
                "hover:bg-accent/50 active:bg-accent",
                activeNotes.has(n.note) ? "bg-accent" : "bg-card"
              )}
              style={{ left: `${i * 44}px`, width: "42px", height: "120px", zIndex: 1 }}
            >
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-mono select-none">
                {n.note.replace("4", "").replace("5", "")}
              </span>
            </button>
          ))}

          {/* Black keys */}
          {BLACK_NOTES.map((n) => {
            const pos = BLACK_KEY_POSITIONS[n.note];
            const leftPx = (pos + 1) * 44 - 14;
            return (
              <button
                key={n.note}
                onPointerDown={() => playNote(n.note, n.freq)}
                className={cn(
                  "absolute top-0 rounded-b-md transition-colors duration-100 select-none",
                  "hover:bg-muted active:bg-muted-foreground/30",
                  activeNotes.has(n.note) ? "bg-muted" : "bg-foreground"
                )}
                style={{ left: `${leftPx}px`, width: "28px", height: "75px", zIndex: 2 }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
