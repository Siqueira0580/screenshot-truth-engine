import { useTuner, INSTRUMENT_PRESETS } from "@/hooks/useTuner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import BackButton from "@/components/ui/BackButton";

const CENTS_RANGE = 50;
const TICK_COUNT = 21;

/* ─── Tuning Ruler ─── */
function TuningRuler({ cents, isInTune }: { cents: number; isInTune: boolean }) {
  const indicatorPos = Math.max(-1, Math.min(1, cents / CENTS_RANGE));

  return (
    <div className="w-full max-w-sm space-y-1">
      <div className="flex justify-between text-[10px] font-mono tracking-wider text-muted-foreground/70 px-1">
        <span>◀ SUBIR</span>
        <span>DESCER ▶</span>
      </div>

      <div className="relative h-14 select-none">
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

        {/* Green zone */}
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
              : cents < 0
                ? "bg-destructive shadow-[0_0_10px_hsl(0_84%_60%/0.4)]"
                : "bg-amber-500 shadow-[0_0_10px_hsl(38_92%_50%/0.4)]"
          )}
          style={{ left: `${50 + indicatorPos * 50}%` }}
        />

        <div className="absolute -bottom-5 inset-x-0 flex justify-between text-[9px] font-mono text-muted-foreground/50 px-0">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function TunerPage() {
  const {
    isActive,
    tunerData,
    instrument,
    targetIndex,
    targetString,
    preset,
    isChromaticMode,
    isPlayingRef,
    toggle,
    changeInstrument,
    setTargetIndex,
    toggleReferenceTone,
  } = useTuner();

  const cents = tunerData?.cents ?? 0;
  const isInTune = tunerData?.isInTune ?? false;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <BackButton />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Afinador
          </h1>
          <p className="text-muted-foreground mt-1">
            Selecione o instrumento e a corda para afinar
          </p>
        </div>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-5">
          {/* Instrument Selector */}
          <div className="w-full max-w-xs">
            <Select value={instrument} onValueChange={changeInstrument}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Instrumento" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSTRUMENT_PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* String Buttons (hidden in chromatic mode) */}
          {!isChromaticMode && (
            <div className="flex flex-wrap justify-center gap-2">
              {preset.strings.map((s, i) => (
                <Button
                  key={s.note}
                  size="sm"
                  variant={targetIndex === i ? "default" : "outline"}
                  className={cn(
                    "min-w-[56px] font-mono text-sm transition-all",
                    targetIndex === i && "ring-2 ring-primary/50"
                  )}
                  onClick={() => setTargetIndex(i)}
                >
                  {s.note}
                </Button>
              ))}
            </div>
          )}

          {/* Target info */}
          {isChromaticMode ? (
            <p className="text-xs text-muted-foreground font-mono">
              Modo Cromático — deteção automática de nota
            </p>
          ) : targetString ? (
            <p className="text-xs text-muted-foreground font-mono">
              Alvo: {targetString.note} — {targetString.hz.toFixed(2)} Hz
            </p>
          ) : null}

          {/* Mic toggle */}
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

          {/* Tuning Display */}
          <div className="w-full flex flex-col items-center gap-5 min-h-[260px] justify-center">
            {isActive && tunerData ? (
              <>
                {/* Detected note */}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-6xl sm:text-7xl font-black tracking-tighter transition-colors duration-500",
                      isInTune ? "text-green-500" : "text-foreground"
                    )}
                  >
                    {tunerData.targetString.note}
                  </span>
                </div>

                {/* Hz and cents */}
                <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
                  <span>{tunerData.detectedHz.toFixed(1)} Hz</span>
                  <span className="text-border">|</span>
                  <span
                    className={cn(
                      "font-bold transition-colors duration-500",
                      isInTune
                        ? "text-green-500"
                        : cents < 0
                          ? "text-destructive"
                          : "text-amber-500"
                    )}
                  >
                    {cents > 0 ? `+${cents}` : cents} cents
                  </span>
                </div>

                {/* Ruler */}
                <TuningRuler cents={cents} isInTune={isInTune} />

                {/* Guided feedback */}
                <div className="h-8 flex justify-center mt-2 text-center">
                  {isInTune ? (
                    <span className="text-sm text-green-500 font-bold">✓ Afinado!</span>
                  ) : cents < -3 ? (
                    <span className="text-xs text-destructive font-semibold">
                      Afinação Baixa — Aperte a tarracha (Subir)
                    </span>
                  ) : cents > 3 ? (
                    <span className="text-xs text-amber-500 font-semibold">
                      Afinação Alta — Afrouxe a tarracha (Descer)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">Quase lá…</span>
                  )}
                </div>
              </>
            ) : isActive ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Mic className="h-12 w-12 animate-pulse text-primary" />
                <p className="text-base">Toque a corda {targetString.note}…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <MicOff className="h-12 w-12" />
                <p className="text-base">Selecione a corda e ligue o afinador</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
