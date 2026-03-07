import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, Search } from "lucide-react";

interface CreateFromSelectionBarProps {
  count: number;
  globalCount?: number;
  onSubmit: (name: string) => Promise<void>;
  onSearchGlobal?: () => void;
}

export default function CreateFromSelectionBar({ count, globalCount = 0, onSubmit, onSearchGlobal }: CreateFromSelectionBarProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const total = count + globalCount;
  if (total === 0) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim());
      setName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-clone-bar className="fixed bottom-16 lg:bottom-0 left-0 right-0 w-full z-50 border-t border-border bg-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] p-4 pb-6 sm:pb-4 animate-fade-in">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>
              📝 Criar com{" "}
              <strong className="text-foreground">{total}</strong> música(s)
              {globalCount > 0 && (
                <span className="text-xs ml-1">({count} do repertório + {globalCount} do acervo)</span>
              )}
            </span>
          </div>
          {onSearchGlobal && (
            <Button variant="outline" size="sm" onClick={onSearchGlobal} className="gap-1.5 shrink-0">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Buscar mais</span>
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Nome do novo repertório..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="gap-2 w-full sm:w-auto shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar
          </Button>
        </div>
      </div>
    </div>
  );
}
