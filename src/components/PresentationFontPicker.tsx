import { Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PRESENTATION_FONTS = [
  { id: "sans", label: "Padrão", family: "'Space Grotesk', sans-serif" },
  { id: "serif", label: "Clássica", family: "'Merriweather', serif" },
  { id: "mono", label: "Máquina", family: "'JetBrains Mono', monospace" },
  { id: "round", label: "Moderna", family: "'Nunito', sans-serif" },
  { id: "slab", label: "Acústica", family: "'Roboto Slab', serif" },
] as const;

export type PresentationFontId = (typeof PRESENTATION_FONTS)[number]["id"];

interface Props {
  value: PresentationFontId;
  onChange: (id: PresentationFontId) => void;
  compact?: boolean;
}

export default function PresentationFontPicker({ value, onChange, compact }: Props) {
  const current = PRESENTATION_FONTS.find((f) => f.id === value) ?? PRESENTATION_FONTS[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={cn(
            "gap-1.5 shrink-0",
            compact ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 text-xs sm:text-sm"
          )}
          title="Fonte de apresentação"
        >
          <Type className="h-3.5 w-3.5" />
          {!compact && <span className="hidden sm:inline">{current.label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5 z-[200]" align="center" side="bottom">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 px-2">
          Tipografia
        </p>
        {PRESENTATION_FONTS.map((font) => (
          <button
            key={font.id}
            onClick={() => onChange(font.id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
              value === font.id
                ? "bg-primary/15 text-primary font-semibold"
                : "hover:bg-muted text-foreground"
            )}
          >
            <span
              className="text-base leading-none w-6 text-center"
              style={{ fontFamily: font.family }}
            >
              Aa
            </span>
            <span className="text-xs">{font.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
