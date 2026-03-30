import { Type, Bold, Italic } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 shrink-0",
                compact ? "h-7 sm:h-8 px-2" : "h-8 text-xs sm:text-sm"
              )}
            >
              <Type className="h-3.5 w-3.5" />
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-medium leading-none"
              >
                {current.label}
              </Badge>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Fonte: <strong>{current.label}</strong>
        </TooltipContent>
      </Tooltip>
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
