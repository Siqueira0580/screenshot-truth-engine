import { useState, forwardRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface ChordEditPopoverProps {
  chordName: string;
  onRename: (newName: string) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export default function ChordEditPopover({
  chordName,
  onRename,
  onDelete,
  children,
}: ChordEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(chordName);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== chordName) {
      onRename(trimmed);
    }
    setOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(chordName); }}>
      <PopoverTrigger asChild>
        <span style={{ display: "contents" }}>{children}</span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" side="top" align="start">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Editar acorde</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="h-8 font-mono text-sm"
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} className="flex-1 gap-1 h-7 text-xs">
            <Pencil className="h-3 w-3" /> Salvar
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} className="gap-1 h-7 text-xs">
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
