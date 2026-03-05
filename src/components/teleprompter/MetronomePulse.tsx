import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StageMetronome, MetronomeMode } from "@/lib/metronome";
import { cn } from "@/lib/utils";
import { Volume2, Eye, EyeOff } from "lucide-react";

interface MetronomePulseProps {
  bpm: number;
  isPlaying: boolean;
}

const PULSE_COLORS: Record<number, string> = {
  1: "bg-green-500/80",
  2: "bg-yellow-500/60",
  3: "bg-red-500/60",
  4: "bg-yellow-500/60",
};

function getBpmColor(bpm: number) {
  if (bpm <= 0) return { text: "text-muted-foreground", border: "border-muted", shadow: "shadow-none", bg: "" };
  if (bpm < 70) return { text: "text-blue-400", border: "border-blue-400/60", shadow: "shadow-[0_0_12px_hsl(210_80%_60%/0.4)]", bg: "bg-blue-500/10" };
  if (bpm <= 100) return { text: "text-green-400", border: "border-green-400/60", shadow: "shadow-[0_0_12px_hsl(140_70%_50%/0.4)]", bg: "bg-green-500/10" };
  if (bpm <= 130) return { text: "text-amber-400", border: "border-amber-400/60", shadow: "shadow-[0_0_12px_hsl(40_90%_55%/0.4)]", bg: "bg-amber-500/10" };
  return { text: "text-red-400", border: "border-red-400/60", shadow: "shadow-[0_0_12px_hsl(0_80%_55%/0.4)]", bg: "bg-red-500/10" };
}

export default function MetronomePulse({ bpm, isPlaying }: MetronomePulseProps) {
  const [mode, setMode] = useState<MetronomeMode>("off");
  const [beat, setBeat] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const metronomeRef = useRef<StageMetronome | null>(null);

  const onPulse = useCallback((beatNum: number) => {
    setBeat(beatNum);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 100);
  }, []);

  useEffect(() => {
    const m = new StageMetronome({ bpm: bpm || 120, mode, onPulse });
    metronomeRef.current = m;
    return () => m.destroy();
  }, []);

  useEffect(() => {
    metronomeRef.current?.setBpm(bpm || 120);
  }, [bpm]);

  useEffect(() => {
    metronomeRef.current?.setMode(mode);
    if (!isPlaying || mode === "off") {
      metronomeRef.current?.stop();
      setBeat(0);
    } else {
      metronomeRef.current?.start();
    }
  }, [mode, isPlaying]);

  const cycleMode = () => {
    const modes: MetronomeMode[] = ["off", "sound+pulse", "pulse"];
    const idx = modes.indexOf(mode);
    setMode(modes[(idx + 1) % modes.length]);
  };

  const modeIcon = mode === "sound+pulse" ? <Volume2 className="h-3 w-3" /> :
                   mode === "pulse" ? <Eye className="h-3 w-3" /> :
                   <EyeOff className="h-3 w-3" />;

  const colors = getBpmColor(bpm);
  const isActive = mode !== "off" && isPlaying;

  return (
    <div className="flex items-center gap-2">
      {/* BPM Badge */}
      <button
        onClick={cycleMode}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-mono text-xs font-semibold transition-all duration-150 select-none",
          isActive ? colors.border : "border-muted",
          isActive ? colors.text : "text-muted-foreground",
          isActive ? colors.bg : "",
          isActive ? colors.shadow : "",
          pulsing && isActive && "animate-bpm-pulse",
        )}
      >
        {modeIcon}
        <span id="hud-bpm" className="tabular-nums">{bpm || "—"}</span>
      </button>

      {/* Beat dots */}
      {mode !== "off" && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((b) => (
            <div
              key={b}
              className={cn(
                "h-3 w-3 rounded-full transition-all duration-75",
                beat === b && pulsing ? PULSE_COLORS[b] : "bg-muted"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
