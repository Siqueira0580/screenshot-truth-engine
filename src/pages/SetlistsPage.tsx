import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ListMusic, Trash2, Calendar, Clock, Users, ArrowUpDown, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSetlists, createSetlist, deleteSetlist } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { format, differenceInDays, differenceInHours, isAfter, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import AutoSetlistGeneratorModal from "@/components/AutoSetlistGeneratorModal";

type SortOption = "newest" | "oldest" | "name_asc" | "name_desc";
type DateFilter = "all" | "7days" | "30days" | "3months";

function formatDaysAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = differenceInHours(new Date(), date);
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atrás`;
  const days = differenceInDays(new Date(), date);
  if (days === 1) return "1 dia atrás";
  if (days < 30) return `${days} dias atrás`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês atrás";
  return `${months} meses atrás`;
}

export default function SetlistsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ["setlists"],
    queryFn: fetchSetlists,
  });

  const filteredAndSorted = useMemo(() => {
    let result = [...setlists];

    if (dateFilter !== "all") {
      const now = new Date();
      const cutoff =
        dateFilter === "7days" ? subDays(now, 7) :
        dateFilter === "30days" ? subMonths(now, 1) :
        subMonths(now, 3);
      result = result.filter((sl: any) => isAfter(new Date(sl.created_at), cutoff));
    }

    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc": return a.name.localeCompare(b.name);
        case "name_desc": return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

    return result;
  }, [setlists, sortBy, dateFilter]);

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
            {filteredAndSorted.length} repertório{filteredAndSorted.length !== 1 ? "s" : ""}
            {dateFilter !== "all" && ` (filtrado de ${setlists.length})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAutoGenOpen(true)} className="gap-1">
            <Sparkles className="h-4 w-4" />
            Sugerir Repertório
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Repertório
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="name_asc">Nome A-Z</SelectItem>
              <SelectItem value="name_desc">Nome Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Último mês</SelectItem>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListMusic className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">
            {setlists.length === 0 ? "Nenhum repertório criado" : "Nenhum repertório encontrado com esses filtros"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((sl: any, i) => (
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

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>Criado: {format(new Date(sl.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    {sl.updated_at && sl.updated_at !== sl.created_at && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {formatDaysAgo(sl.updated_at)}
                      </span>
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
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(sl.id);
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

      <ConfirmDeleteModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteM.mutate(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        description="Tem a certeza de que deseja excluir este repertório? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
