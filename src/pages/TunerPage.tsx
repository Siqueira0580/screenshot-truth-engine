import { useTuner } from "@/hooks/useTuner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

const CENTS_RANGE = 50;
const IN_TUNE_THRESHOLD = 3;

export default function TunerPage() {
  const { isActive, tunerData, toggle } = useTuner();

  const cents = tunerData?.cents ?? 0;
  const isInTune = Math.abs(cents) <= IN_TUNE_THRESHOLD;
  const isFlat = cents < -IN_TUNE_THRESHOLD;
  const isSharp = cents > IN_TUNE_THRESHOLD;

  // Normalized position for the indicator: -1 (flat) to +1 (sharp)
  const indicatorPos = Math.max(-1, Math.min(1, cents / CENTS_RANGE));

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Afinador
        </h1>
        <p className="text-muted-foreground mt-1">
          Afine seu instrumento com precisão usando o microfone
        </p>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-6">
          {/* Toggle Button */}
          <Button
            onClick={toggle}
            size="lg"
            variant={isActive ? "destructive" : "default"}
            className="gap-2 text-base"
          >
            {isActive ? (
              <>
                <MicOff className="h-5 w-5" />
                Desligar Afinador
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Ligar Afinador
              </>
            )}
          </Button>

          {/* Main display area */}
          <div className="w-full flex flex-col items-center gap-4 min-h-[260px] justify-center">
            {isActive && tunerData ? (
              <>
                {/* Frequency */}
                <p className="text-sm font-mono text-muted-foreground">
                  {tunerData.frequency.toFixed(1)} Hz
                </p>

                {/* Note Display */}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-8xl sm:text-9xl font-black tracking-tighter transition-colors duration-200 font-[var(--font-display)]",
                      isInTune && "text-green-500",
                      isFlat && "text-amber-500",
                      isSharp && "text-amber-500"
                    )}
                  >
                    {tunerData.note}
                  </span>
                  <span className="text-2xl font-bold text-muted-foreground">
                    {tunerData.octave}
                  </span>
                </div>

                {/* Cents */}
                <p
                  className={cn(
                    "text-lg font-mono font-bold transition-colors duration-200",
                    isInTune && "text-green-500",
                    isFlat && "text-amber-500",
                    isSharp && "text-amber-500"
                  )}
                >
                  {cents > 0 ? `+${cents}` : cents} cents
                </p>

                {/* Visual Indicator Bar */}
                <div className="w-full max-w-xs space-y-2">
                  {/* Labels */}
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>♭ Flat</span>
                    <span>Afinado</span>
                    <span>Sharp ♯</span>
                  </div>

                  {/* Bar Track */}
                  <div className="relative h-4 rounded-full bg-secondary overflow-hidden">
                    {/* Center marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted-foreground/40 -translate-x-1/2 z-10" />

                    {/* In-tune zone */}
                    <div
                      className="absolute top-0 bottom-0 bg-green-500/20 z-0"
                      style={{
                        left: `${50 - (IN_TUNE_THRESHOLD / CENTS_RANGE) * 50}%`,
                        width: `${(IN_TUNE_THRESHOLD / CENTS_RANGE) * 100}%`,
                      }}
                    />

                    {/* Moving indicator */}
                    <div
                      className={cn(
                        "absolute top-0.5 bottom-0.5 w-3 rounded-full transition-all duration-100 -translate-x-1/2 z-20",
                        isInTune && "bg-green-500 shadow-[0_0_12px_hsl(142_71%_45%/0.6)]",
                        (isFlat || isSharp) && "bg-amber-500 shadow-[0_0_8px_hsl(38_92%_50%/0.4)]"
                      )}
                      style={{
                        left: `${50 + indicatorPos * 50}%`,
                      }}
                    />
                  </div>

                  {/* Arrows / direction hint */}
                  <div className="flex justify-center">
                    {isFlat && (
                      <span className="text-sm text-amber-500 font-medium animate-pulse">
                        ↑ Aperte a corda
                      </span>
                    )}
                    {isSharp && (
                      <span className="text-sm text-amber-500 font-medium animate-pulse">
                        ↓ Solte a corda
                      </span>
                    )}
                    {isInTune && (
                      <span className="text-sm text-green-500 font-bold">
                        ✓ Afinado!
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : isActive ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Mic className="h-12 w-12 animate-pulse text-primary" />
                <p className="text-base">Toque uma nota…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <MicOff className="h-12 w-12" />
                <p className="text-base">Pressione o botão para iniciar</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
