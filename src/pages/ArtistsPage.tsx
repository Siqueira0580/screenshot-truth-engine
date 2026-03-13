import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Users, Trash2, SortAsc, SortDesc, TrendingUp, Music, Search, List, Grid2x2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { fetchArtists, createArtist, deleteArtist, fetchSongs } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { motion } from "framer-motion";
import GuidedTour from "@/components/GuidedTour";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import type { Step } from "react-joyride";

const ARTISTS_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Aqui estão todos os artistas do seu repertório, organizados automaticamente a partir das suas músicas salvas.",
    title: "🎸 Seus Artistas",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "#tour-artist-search",
    content: "Pesquise rapidamente por qualquer artista do seu repertório pelo nome.",
    title: "🔎 Busca de Artistas",
    placement: "bottom",
  },
  {
    target: "#tour-artist-view-toggle",
    content: "Alterne entre visualização em lista, cards médios ou cards grandes conforme a sua preferência.",
    title: "👁️ Modos de Visualização",
    placement: "bottom",
  },
  {
    target: "#tour-artist-sort",
    content: "Ordene os artistas por nome (A-Z, Z-A) ou por popularidade baseada nos seus acessos.",
    title: "📊 Ordenação",
    placement: "bottom",
  },
  {
    target: "#tour-artist-grid",
    content: "Clique num artista para ver o seu perfil completo com todas as músicas salvas na sua biblioteca!",
    title: "🎶 Perfis dos Artistas",
    placement: "top",
  },
];

type SortMode = "alpha_asc" | "alpha_desc" | "most_accessed";
type ViewMode = "list" | "medium" | "large";

export default function ArtistsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [sort, setSort] = useState<SortMode>("alpha_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("medium");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Guided tour
  const { run: runArtistsTour, completeTour, replayTour } = useGuidedTour("artists_page");
  useState(() => {
    (window as any).__replayArtistsTour = replayTour;
  });

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  const { data: songs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
  });

  const artistSongCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const song of songs) {
      if (song.artist) {
        const key = song.artist.toLowerCase();
        map[key] = (map[key] || 0) + 1;
      }
    }
    return map;
  }, [songs]);

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
    let list = [...artists];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

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
  }, [artists, sort, artistAccessMap, searchQuery]);

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

  const gridClass =
    viewMode === "list"
      ? "grid gap-2 grid-cols-1"
      : viewMode === "large"
      ? "grid gap-6 grid-cols-1 lg:grid-cols-2"
      : "grid gap-4 grid-cols-2 lg:grid-cols-3";

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), #e879f9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Artistas
          </h1>
          <p className="text-muted-foreground text-sm">
            {artists.length} artista{artists.length !== 1 ? "s" : ""} no seu repertório
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          size="sm"
          className="font-semibold self-start sm:self-auto"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)",
            boxShadow: "0 0 20px hsla(var(--primary), 0.3)",
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Artista</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div id="tour-artist-search" className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar artista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-primary/20"
          />
        </div>
        <ToggleGroup
          id="tour-artist-view-toggle"
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
          className="rounded-lg"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(0,255,255,0.1)",
          }}
        >
          <ToggleGroupItem value="list" aria-label="Lista" className="px-2.5">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="medium" aria-label="Cards médios" className="px-2.5">
            <Grid2x2 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="large" aria-label="Cards grandes" className="px-2.5">
            <Maximize className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Sort Controls */}
      <div id="tour-artist-sort" className="flex items-center gap-3">
        <ToggleGroup
          type="single"
          value={sort}
          onValueChange={(v) => v && setSort(v as SortMode)}
          className="rounded-lg"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(0,255,255,0.1)",
          }}
        >
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

      {/* Grid / List */}
      {isLoading ? (
        <div className={gridClass}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl"
              style={{ background: "rgba(255,255,255,0.03)" }}
            />
          ))}
        </div>
      ) : sortedArtists.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{
              background: "rgba(0,255,255,0.06)",
              border: "1px solid rgba(0,255,255,0.15)",
              boxShadow: "0 0 30px rgba(0,255,255,0.08)",
            }}
          >
            <Users className="h-9 w-9 text-primary/60" />
          </div>
          <p className="text-lg font-bold text-foreground">
            {searchQuery ? "Nenhum artista encontrado" : "Nenhum artista cadastrado"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? "Tente um termo diferente." : "Importe músicas ou adicione artistas manualmente."}
          </p>
        </motion.div>
      ) : (
        <div id="tour-artist-grid" className={gridClass}>
          {sortedArtists.map((artist, i) => {
            const songCount = artistSongCount[artist.name.toLowerCase()] || 0;
            const initials = artist.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            if (viewMode === "list") {
              return (
                <motion.div
                  key={artist.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    to={`/artist/${encodeURIComponent(artist.name)}`}
                    state={{ photoUrl: artist.photo_url }}
                    className="group flex items-center gap-4 rounded-lg p-3 transition-all hover:bg-primary/5"
                    style={{ border: "1px solid hsl(var(--border))" }}
                  >
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden shrink-0"
                      style={{ border: "2px solid rgba(0,255,255,0.25)" }}
                    >
                      {artist.photo_url ? (
                        <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center text-sm font-black text-primary">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{artist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {songCount} música{songCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteM.mutate(artist.id); }}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                    </button>
                  </Link>
                </motion.div>
              );
            }

            // medium & large share the card layout, just sized differently
            const isLarge = viewMode === "large";
            return (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/artist/${encodeURIComponent(artist.name)}`}
                  state={{ photoUrl: artist.photo_url }}
                  className="group relative block overflow-hidden transition-all duration-300"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)",
                    background: "linear-gradient(145deg, rgba(0,255,255,0.04), rgba(255,255,255,0.02), rgba(168,85,247,0.03))",
                    border: "1px solid rgba(0,255,255,0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.35)";
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(0,255,255,0.1), inset 0 0 30px rgba(0,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400/60 via-transparent to-fuchsia-500/40 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className={`flex flex-col items-center text-center gap-3 ${isLarge ? "p-8" : "p-5"}`}>
                    <div
                      className={`rounded-full overflow-hidden shrink-0 transition-all duration-300 group-hover:scale-105 ${isLarge ? "w-32 h-32" : "w-20 h-20"}`}
                      style={{
                        border: "2px solid rgba(0,255,255,0.3)",
                        boxShadow: "0 0 20px rgba(0,255,255,0.1)",
                      }}
                    >
                      {artist.photo_url ? (
                        <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-secondary flex items-center justify-center font-black text-primary ${isLarge ? "text-3xl" : "text-xl"}`}>
                          {initials}
                        </div>
                      )}
                    </div>

                    <h3 className={`font-bold text-foreground leading-tight line-clamp-2 ${isLarge ? "text-lg" : "text-sm"}`}>{artist.name}</h3>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold px-2.5 py-0.5"
                      style={{
                        borderColor: songCount > 0 ? "rgba(0,255,255,0.25)" : "rgba(255,255,255,0.1)",
                        color: songCount > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                        background: songCount > 0 ? "rgba(0,255,255,0.06)" : "transparent",
                      }}
                    >
                      <Music className="h-3 w-3 mr-1" />
                      {songCount} música{songCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteM.mutate(artist.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </button>

                  <div
                    className="absolute bottom-0 right-0 w-[20px] h-[20px]"
                    style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,255,255,0.15) 50%)" }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          style={{
            background: "hsl(var(--card))",
            border: "1px solid rgba(0,255,255,0.15)",
            boxShadow: "0 0 40px rgba(0,255,255,0.05)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-black">Novo Artista</DialogTitle>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background/50 border-primary/20" />
            </div>
            <div className="space-y-2">
              <Label>Sobre</Label>
              <Textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Informações sobre o artista..." className="bg-background/50 border-primary/20" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                disabled={createM.isPending}
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)" }}
              >
                Criar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
