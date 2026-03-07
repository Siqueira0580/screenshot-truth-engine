import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Hash, User, Music, ClipboardList } from "lucide-react";

export type SortBy = "manual" | "artist" | "key";

interface SetlistToolbarProps {
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  filterKey: string;
  onFilterKeyChange: (key: string) => void;
  availableKeys: string[];
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  selectionCount: number;
  onCreateFromSelection?: () => void;
}

export default function SetlistToolbar({
  sortBy,
  onSortChange,
  filterKey,
  onFilterKeyChange,
  availableKeys,
  allSelected,
  someSelected,
  onSelectAll,
  selectionCount,
}: SetlistToolbarProps) {
  const sortOptions: { value: SortBy; label: string; icon: React.ReactNode }[] = [
    { value: "manual", label: "123", icon: <Hash className="h-3.5 w-3.5" /> },
    { value: "artist", label: "Artista", icon: <User className="h-3.5 w-3.5" /> },
    { value: "key", label: "Tom", icon: <Music className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* Select all */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onSelectAll}
          aria-label="Selecionar tudo"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {selectionCount > 0 ? `${selectionCount} selecionada(s)` : "Selecionar"}
        </span>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      {/* Sort buttons */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
        {sortOptions.map((opt) => (
          <Button
            key={opt.value}
            variant={sortBy === opt.value ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1 px-2"
            onClick={() => onSortChange(opt.value)}
          >
            {opt.icon}
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      {/* Key filter */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Tom:</span>
        <Select value={filterKey} onValueChange={onFilterKeyChange}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tons</SelectItem>
            {availableKeys.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
