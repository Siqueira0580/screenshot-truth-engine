import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Users, Trash2, SortAsc, SortDesc, TrendingUp, Music } from "lucide-react";
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

type SortMode = "alpha_asc" | "alpha_desc" | "most_accessed";

export default function ArtistsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
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

  // Song count per artist
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), #e879f9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Artistas
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {artists.length} artista{artists.length !== 1 ? "s" : ""} no seu repertório
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          className="font-semibold"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)",
            boxShadow: "0 0 20px hsla(var(--primary), 0.3)",
          }}
        >
          <Plus className="h-4 w-4" />
          Novo Artista
        </Button>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-3">
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
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
          <p className="text-lg font-bold text-foreground">Nenhum artista cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Importe músicas ou adicione artistas manualmente.</p>
        </motion.div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {sortedArtists.map((artist, i) => {
            const songCount = artistSongCount[artist.name.toLowerCase()] || 0;
            const initials = artist.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

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
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400/60 via-transparent to-fuchsia-500/40 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="p-5 flex flex-col items-center text-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-20 h-20 rounded-full overflow-hidden shrink-0 transition-all duration-300 group-hover:scale-105"
                      style={{
                        border: "2px solid rgba(0,255,255,0.3)",
                        boxShadow: "0 0 20px rgba(0,255,255,0.1)",
                      }}
                    >
                      {artist.photo_url ? (
                        <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xl font-black text-primary">
                          {initials}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2">{artist.name}</h3>

                    {/* Song count badge */}
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

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteM.mutate(artist.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </button>

                  {/* Bottom chamfer accent */}
                  <div
                    className="absolute bottom-0 right-0 w-[20px] h-[20px]"
                    style={{
                      background: "linear-gradient(135deg, transparent 50%, rgba(0,255,255,0.15) 50%)",
                    }}
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
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)",
                }}
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
