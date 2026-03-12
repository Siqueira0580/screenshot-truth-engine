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

  // Normalized position: -1 (flat) to +1 (sharp)
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
          {/* Toggle */}
          <Button
            onClick={toggle}
            size="lg"
            variant={isActive ? "destructive" : "default"}
            className="gap-2 text-base"
          >
            {isActive ? (
              <><MicOff className="h-5 w-5" /> Desligar Afinador</>
            ) : (
              <><Mic className="h-5 w-5" /> Ligar Afinador</>
            )}
          </Button>

          {/* Main display */}
          <div className="w-full flex flex-col items-center gap-4 min-h-[320px] justify-center">
            {isActive && tunerData ? (
              <>
                {/* Emoji feedback */}
                <div className={cn(
                  "text-5xl transition-transform duration-200",
                  isInTune && "animate-pulse"
                )}>
                  {isInTune ? "👍🏿" : "👎🏿"}
                </div>

                {/* Note */}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-7xl sm:text-8xl font-black tracking-tighter transition-colors duration-200",
                      isInTune && "text-green-500",
                      (isFlat || isSharp) && "text-amber-500"
                    )}
                  >
                    {tunerData.note}
                  </span>
                  <span className="text-2xl font-bold text-muted-foreground">
                    {tunerData.octave}
                  </span>
                </div>

                {/* Technical data */}
                <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
                  <span>{tunerData.frequency.toFixed(1)} Hz</span>
                  <span className="text-border">|</span>
                  <span className={cn(
                    "font-bold transition-colors duration-200",
                    isInTune && "text-green-500",
                    (isFlat || isSharp) && "text-amber-500"
                  )}>
                    {cents > 0 ? `+${cents}` : cents} cents
                  </span>
                </div>

                {/* Gauge */}
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>♭ Grave</span>
                    <span>Afinado</span>
                    <span>Agudo ♯</span>
                  </div>

                  {/* Bar */}
                  <div className="relative h-5 rounded-full bg-secondary overflow-hidden">
                    {/* Center mark */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted-foreground/40 -translate-x-1/2 z-10" />

                    {/* In-tune zone */}
                    <div
                      className="absolute top-0 bottom-0 bg-green-500/20 z-0"
                      style={{
                        left: `${50 - (IN_TUNE_THRESHOLD / CENTS_RANGE) * 50}%`,
                        width: `${(IN_TUNE_THRESHOLD / CENTS_RANGE) * 100}%`,
                      }}
                    />

                    {/* Pointer */}
                    <div
                      className={cn(
                        "absolute top-0.5 bottom-0.5 w-3.5 rounded-full transition-all duration-100 -translate-x-1/2 z-20",
                        isInTune && "bg-green-500 shadow-[0_0_14px_hsl(142_71%_45%/0.6)]",
                        (isFlat || isSharp) && "bg-amber-500 shadow-[0_0_10px_hsl(38_92%_50%/0.4)]"
                      )}
                      style={{ left: `${50 + indicatorPos * 50}%` }}
                    />
                  </div>

                  {/* Direction hint */}
                  <div className="flex justify-center h-5">
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
