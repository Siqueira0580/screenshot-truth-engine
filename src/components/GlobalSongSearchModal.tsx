import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Music2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSongs } from "@/lib/supabase-queries";

interface GlobalSongSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSongIds: Set<string>;
  onToggleSong: (songId: string) => void;
  /** Song IDs already in the current setlist (to label them) */
  existingSetlistSongIds: Set<string>;
}

export default function GlobalSongSearchModal({
  open,
  onOpenChange,
  selectedSongIds,
  onToggleSong,
  existingSetlistSongIds,
}: GlobalSongSearchModalProps) {
  const [search, setSearch] = useState("");

  const { data: allSongs = [], isLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return allSongs.slice(0, 50);
    const term = search.toLowerCase();
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        (s.artist && s.artist.toLowerCase().includes(term))
    );
  }, [allSongs, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar músicas do acervo
          </DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Buscar por título ou artista..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {selectedSongIds.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedSongIds.size} música(s) selecionada(s) do acervo
          </p>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 mt-1 min-h-0 max-h-[50vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma música encontrada</p>
          ) : (
            filtered.map((song) => {
              const isInSetlist = existingSetlistSongIds.has(song.id);
              const isSelected = selectedSongIds.has(song.id);

              return (
                <label
                  key={song.id}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-secondary transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={isSelected || isInSetlist}
                    disabled={isInSetlist}
                    onCheckedChange={() => onToggleSong(song.id)}
                    className="shrink-0"
                  />
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {song.artist}
                      {song.musical_key && ` · ${song.musical_key}`}
                    </p>
                  </div>
                  {isInSetlist && (
                    <span className="text-xs text-muted-foreground shrink-0">Já no repertório</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
