import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ListMusic, ExternalLink, Music2, CalendarDays, Clock, Copy, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  setlistId: string;
  setlistName: string;
  songCount?: number;
  showDate?: string | null;
  showTime?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
}

export default function SetlistRichCard({ setlistId, setlistName, songCount, showDate, showTime, ownerId, ownerName }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCloning, setIsCloning] = useState(false);

  const formattedDate = showDate
    ? format(new Date(showDate), "dd/MM/yyyy", { locale: ptBR })
    : null;

  const isOwner = user?.id === ownerId;

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || isCloning) return;

    setIsCloning(true);
    try {
      // Fetch full setlist data
      const { data: original, error: fetchErr } = await supabase
        .from("setlists")
        .select("*")
        .eq("id", setlistId)
        .single();
      if (fetchErr) throw fetchErr;

      const { data: newRep, error: repError } = await supabase
        .from("setlists")
        .insert({
          name: original.name + " (Cópia)",
          user_id: user.id,
          show_date: original.show_date,
          start_time: original.start_time,
          end_time: original.end_time,
          interval_duration: original.interval_duration,
          show_duration: original.show_duration,
          musicians: original.musicians,
        } as any)
        .select()
        .single();
      if (repError) throw repError;

      const { data: originalItems, error: itemsError } = await supabase
        .from("setlist_items")
        .select("*")
        .eq("setlist_id", setlistId)
        .order("position");
      if (itemsError) throw itemsError;

      if (originalItems && originalItems.length > 0) {
        const newLinks = originalItems.map((item: any) => ({
          setlist_id: (newRep as any).id,
          song_id: item.song_id,
          position: item.position,
          loop_count: item.loop_count,
          speed: item.speed,
          bpm: item.bpm,
          transposed_key: item.transposed_key,
        }));
        const { error: linkError } = await supabase.from("setlist_items").insert(newLinks);
        if (linkError) throw linkError;

        // Add songs to user's library (skip duplicates)
        const songIds = [...new Set(originalItems.map((item: any) => item.song_id as string))];
        const { data: existing } = await supabase
          .from("user_library")
          .select("song_id")
          .eq("user_id", user.id)
          .in("song_id", songIds);
        const existingSet = new Set((existing || []).map((e: any) => e.song_id));
        const newLibrary = songIds
          .filter((sid) => !existingSet.has(sid))
          .map((sid) => ({ user_id: user.id, song_id: sid }));
        if (newLibrary.length > 0) {
          await supabase.from("user_library").insert(newLibrary);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast.success("Repertório clonado com sucesso!");
      navigate(`/setlists/${(newRep as any).id}`);
    } catch (err) {
      console.error("Clone error:", err);
      toast.error("Erro ao clonar repertório");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Link to={`/setlists/${setlistId}`} className="block group">
      <Card className="bg-muted/40 border border-border/60 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:bg-muted/70 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              <ListMusic className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {setlistName}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {typeof songCount === "number" && songCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Music2 className="h-3.5 w-3.5" />
                    {songCount} música{songCount !== 1 ? "s" : ""}
                  </span>
                )}
                {formattedDate && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formattedDate}
                  </span>
                )}
                {showTime && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {showTime}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </Button>
              {user && !isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={isCloning}
                  onClick={handleClone}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isCloning ? "Clonando..." : "Clonar"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
