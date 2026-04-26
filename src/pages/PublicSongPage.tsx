import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import ChordText from "@/components/ChordText";

export default function PublicSongPage() {
  const { id } = useParams();

  const { data: song, isLoading } = useQuery({
    queryKey: ["public-song", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Music2 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Música não encontrada</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 space-y-6 overflow-x-hidden">
      <BackButton />

      <div className="space-y-1">
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{song.title}</h1>
        {song.artist && (
          <p className="text-muted-foreground">{song.artist}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {song.musical_key && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Tom: {song.musical_key}
            </span>
          )}
          {song.bpm && (
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {song.bpm} BPM
            </span>
          )}
          {song.style && (
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {song.style}
            </span>
          )}
        </div>
      </div>

      {song.body_text ? (
        <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-hidden border-y border-border bg-card px-3 py-4 sm:static sm:left-auto sm:w-full sm:max-w-full sm:translate-x-0 sm:rounded-lg sm:border sm:p-6">
          <ChordText text={song.body_text} className="text-sm leading-relaxed" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <Music2 className="h-8 w-8 mb-2 opacity-40" />
          <p>Sem cifra disponível para esta música</p>
        </div>
      )}
    </div>
  );
}
