import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface YouTubeResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  duration: number;
}

interface YouTubeSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
  songArtist?: string | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function YouTubeSearchModal({
  open,
  onOpenChange,
  songId,
  songTitle,
  songArtist,
}: YouTubeSearchModalProps) {
  const queryClient = useQueryClient();
  const defaultQuery = [songTitle, songArtist].filter(Boolean).join(" ");
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Reset & auto-search on open
  useEffect(() => {
    if (open) {
      const q = [songTitle, songArtist].filter(Boolean).join(" ");
      setSearchQuery(q);
      setResults([]);
      setSaving(null);
      if (q.trim()) {
        handleSearch(q);
      }
    }
  }, [open, songTitle, songArtist]);

  const handleSearch = async (q?: string) => {
    const query = (q ?? searchQuery).trim();
    if (!query) return;

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query },
      });
      if (error) throw error;
      setResults(data?.results || []);
      if (!data?.results?.length) {
        toast.info("Nenhum resultado encontrado.");
      }
    } catch (err: any) {
      toast.error(`Erro na busca: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (result: YouTubeResult) => {
    setSaving(result.videoId);
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${result.videoId}`;
      const { error } = await supabase
        .from("songs")
        .update({ youtube_url: youtubeUrl })
        .eq("id", songId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["song", songId] });
      toast.success("Dados atualizados com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao atualizar: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Vincular YouTube
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar no YouTube..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {results.map((r) => (
            <button
              key={r.videoId}
              onClick={() => handleSelect(r)}
              disabled={!!saving}
              className="w-full flex items-start gap-3 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left disabled:opacity-50"
            >
              <div className="relative shrink-0 w-28 aspect-video rounded overflow-hidden bg-muted">
                {r.thumbnail && (
                  <img
                    src={r.thumbnail}
                    alt={r.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {r.duration > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 rounded font-mono">
                    {formatDuration(r.duration)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight line-clamp-2">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{r.channelName}</p>
              </div>
              {saving === r.videoId && (
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-1 text-primary" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
