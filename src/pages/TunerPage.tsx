import { useTuner } from "@/hooks/useTuner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

const CENTS_RANGE = 50;
const TICK_COUNT = 21; // -50 to +50 in steps of 5

function TuningRuler({ cents, isInTune }: { cents: number; isInTune: boolean }) {
  const indicatorPos = Math.max(-1, Math.min(1, cents / CENTS_RANGE));

  return (
    <div className="w-full max-w-sm space-y-1">
      {/* Action labels */}
      <div className="flex justify-between text-[10px] font-mono tracking-wider text-muted-foreground/70 px-1">
        <span>◀ SOLTAR</span>
        <span>APERTAR ▶</span>
      </div>

      {/* Ruler body */}
      <div className="relative h-14 select-none">
        {/* Ticks */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between items-end h-10 px-0.5">
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const value = -50 + i * 5;
            const isCenter = value === 0;
            const isMajor = value % 25 === 0;
            return (
              <div key={i} className="flex flex-col items-center" style={{ width: 2 }}>
                <div
                  className={cn(
                    "w-px rounded-full",
                    isCenter
                      ? cn("h-8", isInTune ? "bg-green-500 w-0.5 shadow-[0_0_8px_hsl(142_71%_45%/0.5)]" : "bg-foreground/60 w-0.5")
                      : isMajor
                        ? "h-5 bg-muted-foreground/50"
                        : "h-3 bg-muted-foreground/25"
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Green zone highlight */}
        <div
          className="absolute bottom-0 h-10 bg-green-500/10 rounded-sm"
          style={{
            left: `${50 - (3 / CENTS_RANGE) * 50}%`,
            width: `${(3 / CENTS_RANGE) * 100}%`,
          }}
        />

        {/* Pointer */}
        <div
          className={cn(
            "absolute bottom-0 w-1 h-12 rounded-full -translate-x-1/2 z-20",
            "transition-[left,background-color,box-shadow] duration-200 ease-out",
            isInTune
              ? "bg-green-500 shadow-[0_0_16px_hsl(142_71%_45%/0.7)]"
              : "bg-amber-500 shadow-[0_0_10px_hsl(38_92%_50%/0.4)]"
          )}
          style={{ left: `${50 + indicatorPos * 50}%` }}
        />

        {/* Cents labels at edges */}
        <div className="absolute -bottom-5 inset-x-0 flex justify-between text-[9px] font-mono text-muted-foreground/50 px-0">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
    </div>
  );
}

export default function TunerPage() {
  const { isActive, tunerData, toggle } = useTuner();

  const cents = tunerData?.cents ?? 0;
  const isInTune = tunerData?.isInTune ?? false;

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
          <Button
            onClick={toggle}
            size="lg"
            variant={isActive ? "destructive" : "default"}
            className="gap-2 text-base"
          >
            {isActive ? (
              <><MicOff className="h-5 w-5" /> Desligar</>
            ) : (
              <><Mic className="h-5 w-5" /> Ligar Afinador</>
            )}
          </Button>

          <div className="w-full flex flex-col items-center gap-5 min-h-[280px] justify-center">
            {isActive && tunerData ? (
              <>
                {/* Note */}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-7xl sm:text-8xl font-black tracking-tighter transition-colors duration-500",
                      isInTune ? "text-green-500" : "text-foreground"
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
                    "font-bold transition-colors duration-500",
                    isInTune ? "text-green-500" : "text-amber-500"
                  )}>
                    {cents > 0 ? `+${cents}` : cents} cents
                  </span>
                </div>

                {/* Ruler gauge */}
                <TuningRuler cents={cents} isInTune={isInTune} />

                {/* Status text */}
                <div className="h-5 flex justify-center mt-2">
                  {isInTune ? (
                    <span className="text-sm text-green-500 font-bold">✓ Afinado</span>
                  ) : cents < 0 ? (
                    <span className="text-xs text-muted-foreground font-mono">Grave — solte a corda</span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">Agudo — aperte a corda</span>
                  )}
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
