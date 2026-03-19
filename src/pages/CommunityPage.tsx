import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Globe, Music2, CalendarDays, Search, Heart, MessageCircle, Send, Instagram, Facebook } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";

interface PublicSetlist {
  id: string;
  name: string;
  show_date: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
  } | null;
  item_count: number;
}

export default function CommunityPage() {
  const [search, setSearch] = useState("");

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ["community-setlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlists")
        .select("id, name, show_date, created_at, user_id, profiles!setlists_user_id_fkey(first_name, last_name, avatar_url, instagram_url, facebook_url)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        const { data: fallback, error: err2 } = await supabase
          .from("setlists")
          .select("id, name, show_date, created_at, user_id")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(100);
        if (err2) throw err2;
        return (fallback || []).map((s: any) => ({ ...s, profiles: null, item_count: 0 }));
      }

      const ids = (data || []).map((s: any) => s.id);
      let countMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: countData } = await supabase
          .from("setlist_items")
          .select("setlist_id")
          .in("setlist_id", ids);
        if (countData) {
          countData.forEach((row: any) => {
            countMap[row.setlist_id] = (countMap[row.setlist_id] || 0) + 1;
          });
        }
      }

      return (data || []).map((s: any) => ({
        ...s,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] || null : s.profiles,
        item_count: countMap[s.id] || 0,
      })) as PublicSetlist[];
    },
  });

  const filtered = setlists.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase())
  );

  const getAuthorName = (p: PublicSetlist["profiles"]) => {
    if (!p) return "Anônimo";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Anônimo";
  };

  const getInitials = (p: PublicSetlist["profiles"]) => {
    if (!p) return "?";
    return [p.first_name, p.last_name]
      .filter(Boolean)
      .map((n) => n![0]?.toUpperCase())
      .join("") || "?";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Explore repertórios publicados por outros músicos e conecte-se com a comunidade.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar repertórios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {search ? "Nenhum repertório encontrado." : "Nenhum repertório publicado ainda. Seja o primeiro!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((setlist) => (
            <div
              key={setlist.id}
              className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
            >
              {/* Author Header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={setlist.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                    {getInitials(setlist.profiles)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {getAuthorName(setlist.profiles)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(setlist.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] gap-1">
                  <Globe className="h-3 w-3" />
                  Público
                </Badge>
              </div>

              {/* Content — clickable to navigate */}
              <Link to={`/setlists/${setlist.id}`} className="block px-5 pb-3 group">
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">
                  {setlist.name}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {setlist.item_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Music2 className="h-3.5 w-3.5" />
                      {setlist.item_count} música{setlist.item_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  {setlist.show_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(new Date(setlist.show_date), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </Link>

              {/* Actions bar */}
              <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
                {/* Placeholder social interactions */}
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" disabled>
                        <Heart className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Em breve</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" disabled>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Em breve</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => toast.info("Funcionalidade de bate-papo interno chegando em breve!")}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar mensagem</TooltipContent>
                  </Tooltip>
                </div>

                {/* Author social links */}
                <div className="flex items-center gap-1">
                  {setlist.profiles?.instagram_url && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={setlist.profiles.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Instagram className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Instagram</TooltipContent>
                    </Tooltip>
                  )}
                  {setlist.profiles?.facebook_url && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={setlist.profiles.facebook_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Facebook className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Facebook</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
