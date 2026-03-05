import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Users, Trash2, LayoutGrid, List, SortAsc, SortDesc, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchArtists, createArtist, deleteArtist, fetchSongs } from "@/lib/supabase-queries";
import { toast } from "sonner";

type ViewMode = "card" | "list";
type SortMode = "alpha_asc" | "alpha_desc" | "most_accessed";

export default function ArtistsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [view, setView] = useState<ViewMode>("card");
  const [sort, setSort] = useState<SortMode>("alpha_asc");
  const queryClient = useQueryClient();

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  const { data: songs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
  });

  // Compute access counts per artist (case-insensitive)
  const artistAccessMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const song of songs) {
      if (song.artist) {
        const key = song.artist.toLowerCase();
        map[key] = (map[key] || 0) + (song.access_count || 0);
      }
    }
    return map;
  }, [songs]);

  const sortedArtists = useMemo(() => {
    const list = [...artists];
    switch (sort) {
      case "alpha_desc":
        list.sort((a, b) => b.name.localeCompare(a.name, "pt"));
        break;
      case "most_accessed":
        list.sort((a, b) => {
          const countA = artistAccessMap[a.name.toLowerCase()] || 0;
          const countB = artistAccessMap[b.name.toLowerCase()] || 0;
          return countB - countA;
        });
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    }
    return list;
  }, [artists, sort, artistAccessMap]);

  const createM = useMutation({
    mutationFn: () => createArtist({ name, about: about || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artists"] });
      toast.success("Artista adicionado!");
      setFormOpen(false);
      setName("");
      setAbout("");
    },
    onError: () => toast.error("Erro ao criar artista"),
  });

  const deleteM = useMutation({
    mutationFn: deleteArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artists"] });
      toast.success("Artista excluído");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Artistas</h1>
          <p className="text-muted-foreground mt-1">
            {artists.length} artista{artists.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Artista
        </Button>
      </div>

      {/* View & Sort Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)} className="border border-border rounded-lg">
          <ToggleGroupItem value="card" aria-label="Cards" className="px-3">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Lista" className="px-3">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="h-5 w-px bg-border" />

        <ToggleGroup type="single" value={sort} onValueChange={(v) => v && setSort(v as SortMode)} className="border border-border rounded-lg">
          <ToggleGroupItem value="alpha_asc" aria-label="A-Z" className="px-3 gap-1 text-xs font-medium">
            <SortAsc className="h-4 w-4" /> A-Z
          </ToggleGroupItem>
          <ToggleGroupItem value="alpha_desc" aria-label="Z-A" className="px-3 gap-1 text-xs font-medium">
            <SortDesc className="h-4 w-4" /> Z-A
          </ToggleGroupItem>
          <ToggleGroupItem value="most_accessed" aria-label="Mais acessadas" className="px-3 gap-1 text-xs font-medium">
            <TrendingUp className="h-4 w-4" /> Popular
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className={view === "card" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-2"}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${view === "card" ? "h-24" : "h-14"} animate-pulse rounded-lg bg-card`} />
          ))}
        </div>
      ) : sortedArtists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhum artista cadastrado</p>
        </div>
      ) : view === "card" ? (
        /* Card View */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedArtists.map((artist, i) => (
            <Link
              to={`/artists/${artist.id}`}
              key={artist.id}
              className="group relative rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {artist.photo_url ? (
                      <AvatarImage src={artist.photo_url} alt={artist.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {artist.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{artist.name}</h3>
                    {artist.about && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{artist.about}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.preventDefault(); deleteM.mutate(artist.id); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="grid gap-1">
          {sortedArtists.map((artist, i) => (
            <Link
              to={`/artists/${artist.id}`}
              key={artist.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all hover:border-primary/30 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <Avatar className="h-8 w-8">
                {artist.photo_url ? (
                  <AvatarImage src={artist.photo_url} alt={artist.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {artist.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium flex-1 truncate">{artist.name}</span>
              {sort === "most_accessed" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {artistAccessMap[artist.name.toLowerCase()] || 0} acessos
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 h-7 w-7"
                onClick={(e) => { e.preventDefault(); deleteM.mutate(artist.id); }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Artista</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createM.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sobre</Label>
              <Textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Informações sobre o artista..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createM.isPending}>Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
