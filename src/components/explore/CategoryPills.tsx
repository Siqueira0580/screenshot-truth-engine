import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const CATEGORIES = ["Todos", "Rock", "Pop", "Sertanejo", "Worship", "Samba", "Pagode"];

interface CategoryPillsProps {
  selected: string;
  onSelect: (cat: string) => void;
}

export default function CategoryPills({ selected, onSelect }: CategoryPillsProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-3 pb-2 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={cn(
              "shrink-0 relative px-5 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-300",
              "clip-polygon-pill",
              selected === cat
                ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_20px_rgba(0,255,255,0.4),0_0_20px_rgba(255,0,255,0.3)]"
                : "bg-slate-800/60 text-slate-300 hover:text-white border border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(0,255,255,0.2)]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
