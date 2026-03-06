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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm p-4 shadow-lg animate-fade-in">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span>📝 Criar novo repertório com <strong className="text-foreground">{count}</strong> música(s)</span>
        </div>
        <Input
          placeholder="Nome do novo repertório..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          size="sm"
          className="gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Criar
        </Button>
      </div>
    </div>
  );
}
