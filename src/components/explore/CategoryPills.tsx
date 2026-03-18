import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const CATEGORIES = ["Todos", "Rock", "Pop", "Sertanejo", "Worship", "Samba", "Pagode", "MPB", "Forró"];

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
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"
                : "bg-secondary text-secondary-foreground hover:text-foreground border border-border hover:border-primary/50 hover:shadow-[var(--shadow-glow)]"
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
