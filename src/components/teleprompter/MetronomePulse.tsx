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

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleMode}
        className={cn(
          "text-foreground h-8 gap-1 text-xs",
          mode !== "off" && "text-primary"
        )}
      >
        {modeIcon}
        <span className="font-mono">{bpm || "—"}</span>
      </Button>
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
