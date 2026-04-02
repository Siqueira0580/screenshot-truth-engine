import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SongEditHistoryProps {
  songId: string;
}

export default function SongEditHistory({ songId }: SongEditHistoryProps) {
  const { data: edits = [], isLoading } = useQuery({
    queryKey: ["song-edits", songId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_edits")
        .select("id, user_id, summary, created_at")
        .eq("song_id", songId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      // Fetch profiles for the user_ids
      const userIds = [...new Set((data || []).map((e: any) => e.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p])
      );

      return (data || []).map((edit: any) => ({
        ...edit,
        profile: profileMap.get(edit.user_id) || null,
      }));
    },
    enabled: !!songId,
  });

  if (isLoading || edits.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <History className="h-4 w-4" />
        Histórico de Edições
      </div>
      <div className="space-y-2">
        {edits.map((edit: any) => {
          const profile = edit.profile;
          const name = profile
            ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Utilizador"
            : "Utilizador";
          const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

          return (
            <div key={edit.id} className="flex items-center gap-3 text-sm">
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{name}</span>
                <span className="text-muted-foreground ml-1.5">{edit.summary}</span>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(edit.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
