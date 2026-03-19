import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  Globe, Music2, CalendarDays, Search, Heart, MessageCircle, Send,
  Instagram, Facebook, Megaphone, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CommentsSheet from "@/components/CommentsSheet";
import CommunityRulesModal from "@/components/CommunityRulesModal";

/* ─── Types ─── */
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

interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

/* ─── Helpers ─── */
const getAuthorName = (p: { first_name: string | null; last_name: string | null } | null) => {
  if (!p) return "Anônimo";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Anônimo";
};

const getInitials = (p: { first_name: string | null; last_name: string | null } | null) => {
  if (!p) return "?";
  return [p.first_name, p.last_name].filter(Boolean).map((n) => n![0]?.toUpperCase()).join("") || "?";
};

/* ═══════════════════════════════════════════════════════ */
export default function CommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeSetlist, setActiveSetlist] = useState<{ id: string; name: string } | null>(null);
  const [postText, setPostText] = useState("");

  /* ── Fetch public setlists ── */
  const { data: setlists = [], isLoading: loadingSetlists } = useQuery({
    queryKey: ["community-setlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlists")
        .select("id, name, show_date, created_at, user_id, profiles!setlists_user_id_fkey(first_name, last_name, avatar_url, instagram_url, facebook_url)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        const { data: fb, error: e2 } = await supabase.from("setlists").select("id, name, show_date, created_at, user_id").eq("is_public", true).order("created_at", { ascending: false }).limit(100);
        if (e2) throw e2;
        return (fb || []).map((s: any) => ({ ...s, profiles: null, item_count: 0 }));
      }

      const ids = (data || []).map((s: any) => s.id);
      let countMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: cd } = await supabase.from("setlist_items").select("setlist_id").in("setlist_id", ids);
        if (cd) cd.forEach((r: any) => { countMap[r.setlist_id] = (countMap[r.setlist_id] || 0) + 1; });
      }

      return (data || []).map((s: any) => ({
        ...s,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] || null : s.profiles,
        item_count: countMap[s.id] || 0,
      })) as PublicSetlist[];
    },
  });

  /* ── Fetch community posts ── */
  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["community-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, user_id, content, created_at, profiles:user_id(first_name, last_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
      })) as CommunityPost[];
    },
  });

  /* ── Likes data ── */
  const setlistIds = setlists.map((s) => s.id);
  const { data: likesData } = useQuery({
    queryKey: ["community-likes", setlistIds],
    enabled: setlistIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("setlist_likes").select("id, user_id, setlist_id").in("setlist_id", setlistIds);
      return data || [];
    },
  });

  const { data: commentsCountData } = useQuery({
    queryKey: ["community-comments-count", setlistIds],
    enabled: setlistIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("setlist_comments").select("setlist_id").in("setlist_id", setlistIds);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.setlist_id] = (map[r.setlist_id] || 0) + 1; });
      return map;
    },
  });

  /* ── Like mutation ── */
  const likeMutation = useMutation({
    mutationFn: async ({ setlistId, isLiked }: { setlistId: string; isLiked: boolean }) => {
      if (isLiked) {
        const { error } = await supabase.from("setlist_likes").delete().eq("setlist_id", setlistId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setlist_likes").insert({ setlist_id: setlistId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onMutate: async ({ setlistId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ["community-likes", setlistIds] });
      const prev = queryClient.getQueryData(["community-likes", setlistIds]);
      queryClient.setQueryData(["community-likes", setlistIds], (old: any[] | undefined) => {
        if (!old) return old;
        if (isLiked) return old.filter((l) => !(l.setlist_id === setlistId && l.user_id === user!.id));
        return [...old, { id: crypto.randomUUID(), user_id: user!.id, setlist_id: setlistId }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(["community-likes", setlistIds], ctx.prev); toast.error("Erro ao processar curtida"); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["community-likes"] }); },
  });

  /* ── Create post mutation ── */
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("community_posts").insert({ user_id: user!.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostText("");
      toast.success("Postagem publicada!");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Erro ao publicar postagem"),
  });

  /* ── Delete post mutation ── */
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Postagem removida");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Erro ao remover postagem"),
  });

  const getLikeInfo = useCallback((setlistId: string) => {
    const likes = (likesData || []).filter((l) => l.setlist_id === setlistId);
    const isLiked = user ? likes.some((l) => l.user_id === user.id) : false;
    return { count: likes.length, isLiked };
  }, [likesData, user]);

  const filteredSetlists = setlists.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPosts = posts.filter((p) => p.content.toLowerCase().includes(search.toLowerCase()));

  const handlePublishPost = () => {
    const trimmed = postText.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) { toast.error("Máximo de 1000 caracteres"); return; }
    createPostMutation.mutate(trimmed);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Comunidade</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Explore, publique e conecte-se com outros músicos.
          </p>
        </div>
        <CommunityRulesModal />
      </div>

      {/* Post Composer */}
      {user && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="O que você quer compartilhar com os músicos? (Busca de banda, aulas, dicas...)"
            maxLength={1000}
            rows={3}
            className="resize-none bg-background"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{postText.length}/1000</span>
            <Button
              size="sm"
              disabled={!postText.trim() || createPostMutation.isPending}
              onClick={handlePublishPost}
              className="gap-1.5"
            >
              {createPostMutation.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              Publicar
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="posts" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Avisos
            {posts.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 ml-1">{posts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="repertoires" className="gap-1.5">
            <Music2 className="h-4 w-4" />
            Repertórios
            {setlists.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 ml-1">{setlists.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Posts Tab ── */}
        <TabsContent value="posts" className="mt-4">
          {loadingPosts ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{search ? "Nenhuma postagem encontrada." : "Nenhuma postagem ainda. Seja o primeiro!"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div key={post.id} className="rounded-xl border border-border bg-card p-4 space-y-3 transition-all hover:border-primary/20">
                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={post.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{getInitials(post.profiles)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{getAuthorName(post.profiles)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {user?.id === post.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deletePostMutation.mutate(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Content */}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {post.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Repertoires Tab ── */}
        <TabsContent value="repertoires" className="mt-4">
          {loadingSetlists ? (
            <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
          ) : filteredSetlists.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Globe className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{search ? "Nenhum repertório encontrado." : "Nenhum repertório publicado ainda."}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredSetlists.map((setlist) => {
                const { count: likeCount, isLiked } = getLikeInfo(setlist.id);
                const commentCount = commentsCountData?.[setlist.id] || 0;

                return (
                  <div key={setlist.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
                    {/* Author Header */}
                    <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={setlist.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{getInitials(setlist.profiles)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{getAuthorName(setlist.profiles)}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(setlist.created_at), "dd/MM/yyyy")}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] gap-1"><Globe className="h-3 w-3" />Público</Badge>
                    </div>

                    {/* Content */}
                    <Link to={`/setlists/${setlist.id}`} className="block px-5 pb-3 group">
                      <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">{setlist.name}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {setlist.item_count > 0 && (
                          <span className="flex items-center gap-1"><Music2 className="h-3.5 w-3.5" />{setlist.item_count} música{setlist.item_count !== 1 ? "s" : ""}</span>
                        )}
                        {setlist.show_date && (
                          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(setlist.show_date), "dd/MM/yyyy")}</span>
                        )}
                      </div>
                    </Link>

                    {/* Actions */}
                    <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className={`h-8 gap-1.5 px-2 ${isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"}`}
                          onClick={() => { if (!user) { toast.info("Faça login para curtir"); return; } likeMutation.mutate({ setlistId: setlist.id, isLiked }); }}
                        >
                          <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                          {likeCount > 0 && <span className="text-xs font-medium">{likeCount}</span>}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-primary" onClick={() => { setActiveSetlist({ id: setlist.id, name: setlist.name }); setCommentsOpen(true); }}>
                          <MessageCircle className="h-4 w-4" />
                          {commentCount > 0 && <span className="text-xs font-medium">{commentCount}</span>}
                        </Button>
                        {user && setlist.user_id !== user.id && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => navigate(`/mensagens/${setlist.user_id}`)}>
                                <Send className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Enviar mensagem</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {setlist.profiles?.instagram_url && (
                          <Tooltip><TooltipTrigger asChild>
                            <a href={setlist.profiles.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-colors"><Instagram className="h-4 w-4" /></a>
                          </TooltipTrigger><TooltipContent>Instagram</TooltipContent></Tooltip>
                        )}
                        {setlist.profiles?.facebook_url && (
                          <Tooltip><TooltipTrigger asChild>
                            <a href={setlist.profiles.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"><Facebook className="h-4 w-4" /></a>
                          </TooltipTrigger><TooltipContent>Facebook</TooltipContent></Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Comments Sheet */}
      {activeSetlist && (
        <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} setlistId={activeSetlist.id} setlistName={activeSetlist.name} />
      )}
    </div>
  );
}
