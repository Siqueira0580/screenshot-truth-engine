import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

const ALL_CATEGORIES = [
  "Todos", "Pop", "Rock", "Sertanejo", "Worship", "Samba",
  "Pagode", "Forró", "MPB", "Gospel", "Eletrônica", "Reggae", "Funk",
];

interface CategoryPillsProps {
  selected: string;
  onSelect: (cat: string) => void;
  defaultGenre?: string;
}

function reorderCategories(categories: string[], defaultGenre?: string): string[] {
  if (!defaultGenre || defaultGenre === "Todos") return categories;
  const match = categories.find((c) => c.toLowerCase() === defaultGenre.toLowerCase());
  if (!match || match === "Todos") return categories;
  return [match, ...categories.filter((c) => c !== match)];
}

export default function CategoryPills({ selected, onSelect, defaultGenre }: CategoryPillsProps) {
  const isMobile = useIsMobile();
  const visibleCount = isMobile ? 4 : 6;
  const ordered = reorderCategories(ALL_CATEGORIES, defaultGenre);
  const visible = ordered.slice(0, visibleCount);
  const overflow = ordered.slice(visibleCount);
  const isOverflowSelected = overflow.some((c) => c === selected);

  return (
    <div className="flex items-center gap-2 pb-2 px-1 overflow-x-auto scrollbar-none">
      {visible.map((cat) => (
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

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "shrink-0 relative px-5 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1",
                "clip-polygon-pill",
                isOverflowSelected
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "bg-secondary text-secondary-foreground hover:text-foreground border border-border hover:border-primary/50 hover:shadow-[var(--shadow-glow)]"
              )}
            >
              {isOverflowSelected ? selected : "Mais"}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {overflow.map((cat) => (
              <DropdownMenuItem
                key={cat}
                onClick={() => onSelect(cat)}
                className={cn(
                  "cursor-pointer font-medium uppercase text-sm tracking-wide",
                  selected === cat && "bg-accent text-accent-foreground"
                )}
              >
                {cat}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
