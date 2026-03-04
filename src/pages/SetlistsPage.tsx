import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ListMusic, Trash2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fetchSetlists, createSetlist, deleteSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SetlistsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ["setlists"],
    queryFn: fetchSetlists,
  });

  const createM = useMutation({
    mutationFn: () => createSetlist({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast.success("Setlist criada!");
      setFormOpen(false);
      setName("");
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast.success("Setlist excluída");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
          <p className="text-muted-foreground mt-1">
            {setlists.length} setlist{setlists.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Setlist
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : setlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListMusic className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhuma setlist criada</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {setlists.map((sl, i) => (
            <Link
              key={sl.id}
              to={`/setlists/${sl.id}`}
              className="group relative rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{sl.name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(sl.created_at), "dd/MM/yyyy")}
                    </span>
                    {sl.show_duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {sl.show_duration} min
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    deleteM.mutate(sl.id);
                  }}
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
            <DialogTitle>Nova Setlist</DialogTitle>
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
              <Label>Nome da Setlist</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Show Sexta-feira" />
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
