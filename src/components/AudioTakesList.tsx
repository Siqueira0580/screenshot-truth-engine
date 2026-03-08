import { useState, useRef, useCallback } from "react";
import { Play, Pause, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

export interface AudioTake {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

interface AudioTakesListProps {
  takes: AudioTake[];
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

export default function AudioTakesList({ takes, onRename, onDelete }: AudioTakesListProps) {
  const [open, setOpen] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback((take: AudioTake) => {
    if (playingId === take.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(take.url);
    } else {
      audioRef.current.pause();
      audioRef.current.src = take.url;
    }
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play();
    setPlayingId(take.id);
  }, [playingId]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
      " às " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (takes.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/50 transition-colors rounded-t-xl">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Ideias Gravadas ({takes.length})
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
        </CollapsibleTrigger>

        <CollapsibleContent className="divide-y divide-border">
          {takes.map((take) => (
            <div
              key={take.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors"
            >
              {/* Play/Pause */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handlePlay(take)}
                    className={cn(
                      "shrink-0 flex items-center justify-center w-9 h-9 rounded-full border transition-all",
                      playingId === take.id
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:text-primary hover:border-primary/50"
                    )}
                  >
                    {playingId === take.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{playingId === take.id ? "Pausar" : "Ouvir"}</p></TooltipContent>
              </Tooltip>

              {/* Title + date */}
              <div className="flex-1 min-w-0">
                <input
                  value={take.title}
                  onChange={(e) => onRename(take.id, e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none placeholder:text-muted-foreground truncate"
                  placeholder="Nome da ideia..."
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(take.createdAt)}</p>
              </div>

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(take.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Excluir</p></TooltipContent>
              </Tooltip>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <ConfirmDeleteModal
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            if (playingId === deleteId) {
              audioRef.current?.pause();
              setPlayingId(null);
            }
            setDeleteId(null);
          }
        }}
        title="Excluir Gravação"
        description="Tem certeza que deseja excluir esta gravação? Esta ação não pode ser desfeita."
      />
    </TooltipProvider>
  );
}
