import { Wrench, Bold, Italic, Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRESENTATION_FONTS, type PresentationFontId } from "@/components/PresentationFontPicker";
import { cn } from "@/lib/utils";

interface TextToolsPopoverProps {
  font: PresentationFontId;
  onFontChange: (id: PresentationFontId) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  isBold: boolean;
  isItalic: boolean;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  compact?: boolean;
}

export default function TextToolsPopover({
  font,
  onFontChange,
  fontSize,
  onFontSizeChange,
  isBold,
  isItalic,
  onToggleBold,
  onToggleItalic,
  compact,
}: TextToolsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("shrink-0", compact ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8 sm:h-9 sm:w-9")}
        >
          <Wrench className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 z-[200] space-y-3"
        align="center"
        side="top"
        onInteractOutside={(e) => {
          // Prevent closing when interacting with select dropdown
          const target = e.target as HTMLElement;
          if (target?.closest?.("[data-radix-select-content]")) {
            e.preventDefault();
          }
        }}
      >
        {/* Font Family */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Fonte
          </label>
          <Select value={font} onValueChange={(v) => onFontChange(v as PresentationFontId)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[300]">
              {PRESENTATION_FONTS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.family }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bold & Italic */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Estilo
          </label>
          <div className="flex items-center gap-1">
            <Toggle
              size="sm"
              pressed={isBold}
              onPressedChange={onToggleBold}
              aria-label="Negrito"
              className="h-8 w-8 p-0"
            >
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={isItalic}
              onPressedChange={onToggleItalic}
              aria-label="Itálico"
              className="h-8 w-8 p-0"
            >
              <Italic className="h-4 w-4" />
            </Toggle>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Tamanho ({fontSize}px)
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onFontSizeChange(Math.max(fontSize - 2, 12))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Slider
              value={[fontSize]}
              onValueChange={([v]) => onFontSizeChange(v)}
              min={12}
              max={60}
              step={1}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onFontSizeChange(Math.min(fontSize + 2, 60))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
