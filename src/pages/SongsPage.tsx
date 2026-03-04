import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Music2, Trash2, Edit, Eye, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSongs, deleteSong } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SongFormDialog from "@/components/SongFormDialog";

export default function SongsPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
  });

  const deleteM = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Música excluída");
    },
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-sqlite`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      queryClient.invalidateQueries({ queryKey: ["artists"] });

      toast.success(
        `Importação concluída! ${result.songs} músicas, ${result.setlists} setlists, ${result.artists} artistas, ${result.setlist_items} itens de setlist.`
      );

      if (result.errors?.length > 0) {
        console.warn("Import errors:", result.errors);
        toast.warning(`${result.errors.length} erro(s) durante a importação. Veja o console.`);
      }
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Músicas</h1>
          <p className="text-muted-foreground mt-1">
            {songs.length} música{songs.length !== 1 ? "s" : ""} no repertório
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing ? "Importando..." : "Importar SQLite"}
          </Button>
          <Button onClick={() => { setEditingSong(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nova Música
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou artista..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Music2 className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhuma música encontrada</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((song, i) => (
            <div
              key={song.id}
              className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-sm font-bold">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{song.title}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {song.artist && <span>{song.artist}</span>}
                  {song.musical_key && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                      {song.musical_key}
                    </span>
                  )}
                  {song.bpm && <span>{song.bpm} BPM</span>}
                  {song.style && <span>{song.style}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/songs/${song.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditingSong(song.id); setFormOpen(true); }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteM.mutate(song.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SongFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        songId={editingSong}
      />
    </div>
  );
}
