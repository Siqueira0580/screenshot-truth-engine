import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, GripVertical, Music2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  fetchSetlist,
  fetchSetlistItems,
  fetchSongs,
  addSongToSetlist,
  removeSongFromSetlist,
} from "@/lib/supabase-queries";
import { toast } from "sonner";
import Teleprompter from "@/components/Teleprompter";

export default function SetlistDetailPage() {
  const { id } = useParams();
  const [addOpen, setAddOpen] = useState(false);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: setlist } = useQuery({
    queryKey: ["setlist", id],
    queryFn: () => fetchSetlist(id!),
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["setlist-items", id],
    queryFn: () => fetchSetlistItems(id!),
    enabled: !!id,
  });

  const { data: allSongs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
    enabled: addOpen,
  });

  const addMutation = useMutation({
    mutationFn: (songId: string) => addSongToSetlist(id!, songId, items.length + 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      toast.success("Música adicionada!");
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeSongFromSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      toast.success("Música removida");
    },
  });

  const existingIds = new Set(items.map((i: any) => i.song_id));
  const availableSongs = allSongs.filter(
    (s) =>
      !existingIds.has(s.id) &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.artist && s.artist.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" asChild className="gap-2">
        <Link to="/setlists">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{setlist?.name}</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} música{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="outline" onClick={() => setTeleprompterOpen(true)} className="gap-2">
              <MonitorPlay className="h-4 w-4" />
              Teleprompter
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Music2 className="h-10 w-10 mb-3 opacity-40" />
          <p>Nenhuma música na setlist</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            Adicionar música
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item: any, i: number) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-mono text-sm font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/songs/${item.song_id}`} className="font-medium hover:text-primary transition-colors">
                  {item.songs?.title}
                </Link>
                <p className="text-sm text-muted-foreground truncate">
                  {item.songs?.artist}
                  {item.songs?.musical_key && ` · ${item.songs.musical_key}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => removeMutation.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Adicionar Música</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-1 mt-2">
            {availableSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma música disponível
              </p>
            ) : (
              availableSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => addMutation.mutate(song.id)}
                  className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-secondary transition-colors"
                >
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {song.artist} {song.musical_key && `· ${song.musical_key}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Teleprompter
        songs={items.map((item: any) => ({
          title: item.songs?.title || "",
          artist: item.songs?.artist,
          musical_key: item.songs?.musical_key,
          bpm: item.songs?.bpm ?? item.bpm,
          body_text: item.songs?.body_text,
          loop_count: item.loop_count ?? item.songs?.loop_count,
          auto_next: item.songs?.auto_next,
        }))}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
    </div>
  );
}
