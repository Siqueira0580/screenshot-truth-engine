import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Music2, CalendarDays, Clock, Users, ListMusic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PublicSetlistPage() {
  const { token } = useParams();

  const { data: setlist, isLoading: loadingSetlist } = useQuery({
    queryKey: ["public-setlist", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlists")
        .select("id, name, show_date, start_time, end_time, musicians, interval_duration, show_duration")
        .eq("public_share_token", token!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["public-setlist-items", setlist?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_items")
        .select("*, songs(id, title, artist, musical_key)")
        .eq("setlist_id", setlist!.id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!setlist?.id,
  });

  if (loadingSetlist || loadingItems) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <ListMusic className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Repertório não encontrado</p>
        <p className="text-sm mt-1">Este link pode estar inválido ou o repertório foi removido.</p>
      </div>
    );
  }

  const sl = setlist as any;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{sl.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <Badge variant="secondary">{items.length} música{items.length !== 1 ? "s" : ""}</Badge>
          {sl.show_date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {format(new Date(sl.show_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
          {sl.start_time && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {sl.start_time}
              {sl.end_time && ` às ${sl.end_time}`}
            </span>
          )}
          {sl.musicians && sl.musicians.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              {sl.musicians.join(", ")}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Music2 className="h-10 w-10 mb-3 opacity-40" />
          <p>Nenhuma música neste repertório</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, index: number) => (
            <Link
              key={item.id}
              to={`/share/song/${item.song_id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-mono text-sm font-bold">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{item.songs?.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {item.songs?.artist}
                  {item.songs?.musical_key && ` · ${item.songs.musical_key}`}
                </p>
              </div>
              <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
