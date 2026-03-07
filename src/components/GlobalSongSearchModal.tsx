import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Music2, Search, FolderOpen, ArrowLeft, CheckSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSetlists, fetchSetlistItems } from "@/lib/supabase-queries";

interface GlobalSongSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSongIds: Set<string>;
  onToggleSong: (songId: string) => void;
  onBulkToggleSongs: (songIds: string[], add: boolean) => void;
  /** Song IDs already in the current setlist (to label them) */
  existingSetlistSongIds: Set<string>;
  /** Current setlist ID to exclude from folder list */
  currentSetlistId?: string;
}

export default function GlobalSongSearchModal({
  open,
  onOpenChange,
  selectedSongIds,
  onToggleSong,
  onBulkToggleSongs,
  existingSetlistSongIds,
  currentSetlistId,
}: GlobalSongSearchModalProps) {
  const [currentView, setCurrentView] = useState<"setlists" | "songs">("setlists");
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Fetch all setlists for folder view
  const { data: allSetlists = [], isLoading: loadingSetlists } = useQuery({
    queryKey: ["setlists"],
    queryFn: fetchSetlists,
    enabled: open,
  });

  // Fetch songs of selected setlist
  const { data: setlistItems = [], isLoading: loadingSongs } = useQuery({
    queryKey: ["setlist-items", activeSetlistId],
    queryFn: () => fetchSetlistItems(activeSetlistId!),
    enabled: !!activeSetlistId && currentView === "songs",
  });

  // Filter out current setlist from folder list
  const folders = useMemo(() => {
    const filtered = currentSetlistId
      ? allSetlists.filter((s) => s.id !== currentSetlistId)
      : allSetlists;
    if (!search.trim()) return filtered;
    const term = search.toLowerCase();
    return filtered.filter((s) => s.name.toLowerCase().includes(term));
  }, [allSetlists, currentSetlistId, search]);

  // Extract songs from setlist items
  const folderSongs = useMemo(() => {
    return setlistItems
      .filter((item: any) => item.songs)
      .map((item: any) => ({
        id: item.songs.id as string,
        title: item.songs.title as string,
        artist: item.songs.artist as string | null,
        musical_key: item.songs.musical_key as string | null,
      }));
  }, [setlistItems]);

  // Filter songs by search within folder
  const filteredSongs = useMemo(() => {
    if (!search.trim()) return folderSongs;
    const term = search.toLowerCase();
    return folderSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        (s.artist && s.artist.toLowerCase().includes(term))
    );
  }, [folderSongs, search]);

  // Selectable song IDs (not already in the current setlist)
  const selectableSongIds = useMemo(
    () => filteredSongs.filter((s) => !existingSetlistSongIds.has(s.id)).map((s) => s.id),
    [filteredSongs, existingSetlistSongIds]
  );

  // "Select all" state
  const allSelected = selectableSongIds.length > 0 && selectableSongIds.every((id) => selectedSongIds.has(id));
  const someSelected = selectableSongIds.some((id) => selectedSongIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onBulkToggleSongs(selectableSongIds, false);
    } else {
      onBulkToggleSongs(selectableSongIds, true);
    }
  }, [allSelected, selectableSongIds, onBulkToggleSongs]);

  const handleOpenFolder = (setlistId: string) => {
    setActiveSetlistId(setlistId);
    setCurrentView("songs");
    setSearch("");
  };

  const handleBack = () => {
    setCurrentView("setlists");
    setActiveSetlistId(null);
    setSearch("");
  };

  // Reset view when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setCurrentView("setlists");
      setActiveSetlistId(null);
      setSearch("");
    }
    onOpenChange(open);
  };

  const activeSetlistName = allSetlists.find((s) => s.id === activeSetlistId)?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentView === "songs" ? (
              <FolderOpen className="h-5 w-5 text-primary" />
            ) : (
              <Search className="h-5 w-5 text-primary" />
            )}
            {currentView === "songs" ? activeSetlistName : "Buscar músicas por repertório"}
          </DialogTitle>
        </DialogHeader>

        {currentView === "songs" && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="self-start gap-1.5 -mt-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Pastas
          </Button>
        )}

        <Input
          placeholder={currentView === "setlists" ? "Filtrar repertórios..." : "Filtrar músicas..."}
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
          {/* VIEW: Setlist folders */}
          {currentView === "setlists" && (
            <>
              {loadingSetlists ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum repertório encontrado</p>
              ) : (
                folders.map((setlist) => (
                  <button
                    key={setlist.id}
                    onClick={() => handleOpenFolder(setlist.id)}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-secondary transition-colors cursor-pointer w-full text-left"
                  >
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{setlist.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {setlist.show_date
                          ? new Date(setlist.show_date).toLocaleDateString("pt-BR")
                          : "Sem data"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </>
          )}

          {/* VIEW: Songs inside a folder */}
          {currentView === "songs" && (
            <>
              {loadingSongs ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando músicas...</p>
              ) : filteredSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma música neste repertório</p>
              ) : (
                <>
                  {/* Select All header */}
                  {selectableSongIds.length > 0 && (
                    <label className="flex items-center gap-3 rounded-lg p-3 bg-secondary/50 cursor-pointer sticky top-0 z-10 border-b border-border">
                      <Checkbox
                        checked={allSelected}
                        // @ts-ignore – indeterminate supported by radix
                        indeterminate={someSelected && !allSelected ? true : undefined}
                        onCheckedChange={handleSelectAll}
                        className="shrink-0"
                      />
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">
                        Selecionar todas ({selectableSongIds.length})
                      </span>
                    </label>
                  )}

                  {filteredSongs.map((song) => {
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
                  })}
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
