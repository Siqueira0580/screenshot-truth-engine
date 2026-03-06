import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ListMusic, Trash2, Calendar, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchSetlists, createSetlist, deleteSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { format } from "date-fns";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";

export default function SetlistsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ["setlists"],
    queryFn: fetchSetlists,
  });

  const createM = useMutation({
    mutationFn: (data: any) => createSetlist(data),
    onSuccess: (newSetlist) => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast.success("Repertório criado!");
      navigate(`/setlists/${newSetlist.id}`);
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast.success("Repertório excluído");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repertórios</h1>
          <p className="text-muted-foreground mt-1">
            {setlists.length} repertório{setlists.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Repertório
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : setlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListMusic className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhum repertório criado</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {setlists.map((sl: any, i) => (
            <Link
              key={sl.id}
              to={`/setlists/${sl.id}`}
              className="group relative rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg truncate">{sl.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {sl.show_date
                        ? format(new Date(sl.show_date), "dd/MM/yyyy")
                        : format(new Date(sl.created_at), "dd/MM/yyyy")}
                    </span>
                    {sl.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {sl.start_time}{sl.end_time && ` - ${sl.end_time}`}
                      </span>
                    )}
                    {sl.show_duration && (
                      <Badge variant="outline" className="text-xs font-normal h-5">
                        {sl.show_duration}min
                      </Badge>
                    )}
                  </div>
                  {sl.musicians && (sl.musicians as string[]).length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{(sl.musicians as string[]).join(", ")}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 shrink-0"
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

      <SetlistSettingsModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        setlist={null}
        onSave={async (data) => {
          await createM.mutateAsync({
            name: data.name,
            show_date: data.show_date,
            show_duration: data.show_duration,
            start_time: data.start_time,
            interval_duration: data.interval_duration,
            end_time: data.end_time,
            musicians: data.musicians,
          });
        }}
      />
    </div>
  );
}
