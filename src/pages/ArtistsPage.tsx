import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchArtists, createArtist, deleteArtist } from "@/lib/supabase-queries";
import { toast } from "sonner";

export default function ArtistsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const queryClient = useQueryClient();

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

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

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhum artista cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist, i) => (
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
