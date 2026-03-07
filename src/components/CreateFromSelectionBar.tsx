import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2 } from "lucide-react";

interface CreateFromSelectionBarProps {
  count: number;
  onSubmit: (name: string) => Promise<void>;
}

export default function CreateFromSelectionBar({ count, onSubmit }: CreateFromSelectionBarProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  if (count === 0) return null;

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
    <div className="fixed bottom-0 left-0 right-0 w-full z-50 border-t border-border bg-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] p-4 pb-6 sm:pb-4 animate-fade-in">
      <div className="max-w-3xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span>📝 Criar com <strong className="text-foreground">{count}</strong> música(s)</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-1 sm:ml-3">
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
