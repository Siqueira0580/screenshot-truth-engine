import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  Globe, Music2, CalendarDays, Search, Heart, MessageCircle, Send,
  Instagram, Facebook, Megaphone, MoreHorizontal, Pencil, Trash2,
  ShieldAlert, Ban, Youtube, Users, ImagePlus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CommentsSheet from "@/components/CommentsSheet";
import CommunityRulesModal from "@/components/CommunityRulesModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CreateGroupModal from "@/components/community/CreateGroupModal";
import GroupFeed from "@/components/community/GroupFeed";
import SetlistRichCard from "@/components/community/SetlistRichCard";

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
  updated_at: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  image_url: string | null;
  group_id: string | null;
  setlist_id: string | null;
  setlist: { id: string; name: string; show_date?: string | null; start_time?: string | null; user_id?: string | null; setlist_items?: { id: string }[] } | null;
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

const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
};

/* ═══════════════════════════════════════════════════════ */
export default function CommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeSetlist, setActiveSetlist] = useState<{ id: string; name: string } | null>(null);
  const [mainTab, setMainTab] = useState("geral");

  // Post composer state
  const [postText, setPostText] = useState("");
  const [postYoutube, setPostYoutube] = useState("");
  const [postInstagram, setPostInstagram] = useState("");
  const [postFacebook, setPostFacebook] = useState("");
  const [postDestination, setPostDestination] = useState("general");
  const [activeMediaInputs, setActiveMediaInputs] = useState<Set<string>>(new Set());
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const toggleMediaInput = (key: string) => {
    setActiveMediaInputs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Edit modal state
  const [editPost, setEditPost] = useState<CommunityPost | null>(null);
  const [editText, setEditText] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editFacebook, setEditFacebook] = useState("");

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; isAdmin?: boolean } | null>(null);

  // Group feed state
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string; isCreator: boolean } | null>(null);

  /* ── Fetch current user profile (is_banned, is_admin) ── */
  const { data: currentProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_banned, is_admin").eq("id", user!.id).single();
      return data as { is_banned: boolean | null; is_admin: boolean | null } | null;
    },
  });

  const isBanned = currentProfile?.is_banned === true;
  const isAdmin = currentProfile?.is_admin === true;

  /* ── Fetch user's groups ── */
  const { data: myGroups = [] } = useQuery({
    queryKey: ["my-community-groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Groups where user is member
      const { data: memberships } = await supabase
        .from("community_group_members")
        .select("group_id")
        .eq("user_id", user!.id);

      const groupIds = (memberships || []).map((m: any) => m.group_id);
      if (groupIds.length === 0) return [];

      const { data: groups } = await supabase
        .from("community_groups")
        .select("id, name, created_by, created_at")
        .in("id", groupIds)
        .order("created_at", { ascending: false });

      return (groups || []).map((g: any) => ({
        ...g,
        isCreator: g.created_by === user!.id,
      }));
    },
  });

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

  /* ── Fetch community posts (general only, group_id IS NULL) ── */
  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["community-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, user_id, content, created_at, updated_at, youtube_url, instagram_url, facebook_url, image_url, group_id, setlist_id, profiles:user_id(first_name, last_name, avatar_url), setlist:setlist_id(id, name, show_date, start_time, user_id, setlist_items(id))")
        .is("group_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
        setlist: Array.isArray(p.setlist) ? p.setlist[0] || null : p.setlist,
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

        // Notify setlist owner
        const setlist = setlists.find((s) => s.id === setlistId);
        if (setlist && setlist.user_id !== user!.id) {
          const { data: myProfile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user!.id).single();
          const myName = myProfile ? [myProfile.first_name, myProfile.last_name].filter(Boolean).join(" ") || "Alguém" : "Alguém";
          await supabase.from("notifications").insert({
            user_id: setlist.user_id,
            type: "setlist_like",
            title: `${myName} curtiu "${setlist.name}"`,
            metadata: { setlist_id: setlistId },
          } as any);
        }
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
    mutationFn: async (payload: { content: string; youtube_url?: string; instagram_url?: string; facebook_url?: string; group_id?: string | null; image_url?: string | null }) => {
      const { error } = await supabase.from("community_posts").insert({
        user_id: user!.id,
        content: payload.content,
        youtube_url: payload.youtube_url || null,
        instagram_url: payload.instagram_url || null,
        facebook_url: payload.facebook_url || null,
        group_id: payload.group_id || null,
        image_url: payload.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostText(""); setPostYoutube(""); setPostInstagram(""); setPostFacebook(""); setPostDestination("general");
      setPostImageFile(null); setPostImagePreview(null);
      toast.success("Postagem publicada!");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      queryClient.invalidateQueries({ queryKey: ["group-posts"] });
    },
    onError: () => toast.error("Erro ao publicar postagem"),
  });

  /* ── Update post mutation ── */
  const updatePostMutation = useMutation({
    mutationFn: async (payload: { id: string; content: string; youtube_url?: string; instagram_url?: string; facebook_url?: string }) => {
      const { error } = await supabase.from("community_posts").update({
        content: payload.content,
        youtube_url: payload.youtube_url || null,
        instagram_url: payload.instagram_url || null,
        facebook_url: payload.facebook_url || null,
        updated_at: new Date().toISOString(),
      }).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditPost(null);
      toast.success("Postagem atualizada!");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Erro ao atualizar postagem"),
  });

  /* ── Delete post mutation ── */
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Postagem removida");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Erro ao remover postagem"),
  });

  /* ── Ban user mutation ── */
  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ is_banned: true }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Utilizador banido da comunidade"),
    onError: () => toast.error("Erro ao banir utilizador"),
  });

  const getLikeInfo = useCallback((setlistId: string) => {
    const likes = (likesData || []).filter((l) => l.setlist_id === setlistId);
    const isLiked = user ? likes.some((l) => l.user_id === user.id) : false;
    return { count: likes.length, isLiked };
  }, [likesData, user]);

  const filteredSetlists = setlists.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPosts = posts.filter((p) => p.content.toLowerCase().includes(search.toLowerCase()));

  const handlePublishPost = async () => {
    const trimmed = postText.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) { toast.error("Máximo de 1000 caracteres"); return; }

    let imageUrl: string | null = null;
    if (postImageFile) {
      setUploadingImage(true);
      try {
        const ext = postImageFile.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community-images").upload(path, postImageFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("community-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      } catch {
        toast.error("Erro ao enviar imagem");
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    createPostMutation.mutate({
      content: trimmed,
      youtube_url: postYoutube.trim() || undefined,
      instagram_url: postInstagram.trim() || undefined,
      facebook_url: postFacebook.trim() || undefined,
      group_id: postDestination === "general" ? null : postDestination,
      image_url: imageUrl,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são permitidas"); return; }
    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const openEditModal = (post: CommunityPost) => {
    setEditPost(post);
    setEditText(post.content);
    setEditYoutube(post.youtube_url || "");
    setEditInstagram(post.instagram_url || "");
    setEditFacebook(post.facebook_url || "");
  };

  const handleSaveEdit = () => {
    if (!editPost) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) { toast.error("Máximo de 1000 caracteres"); return; }
    updatePostMutation.mutate({
      id: editPost.id,
      content: trimmed,
      youtube_url: editYoutube.trim() || undefined,
      instagram_url: editInstagram.trim() || undefined,
      facebook_url: editFacebook.trim() || undefined,
    });
  };

  // If viewing a specific group feed
  if (activeGroup) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <GroupFeed
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          isCreator={activeGroup.isCreator}
          onBack={() => setActiveGroup(null)}
        />
      </div>
    );
  }

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

      {/* Main Tabs: Geral / Meus Grupos */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="geral" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5">
            <Users className="h-4 w-4" />
            Meus Grupos
            {myGroups.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 ml-1">{myGroups.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ══════ GERAL TAB ══════ */}
        <TabsContent value="geral" className="mt-4 space-y-5">
          {/* Post Composer or Banned Message */}
          {user && (
            isBanned ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                <Ban className="h-6 w-6 mx-auto text-destructive mb-2" />
                <p className="text-sm text-destructive font-medium">
                  A sua conta foi suspensa da comunidade por violar as regras.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <Textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="O que você quer compartilhar com os músicos? (Busca de banda, aulas, dicas...)"
                  maxLength={1000}
                  rows={3}
                  className="resize-none bg-background"
                />
                {/* Destination selector */}
                <Select value={postDestination} onValueChange={setPostDestination}>
                  <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
                    <SelectValue placeholder="Onde deseja publicar?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Comunidade Geral
                      </span>
                    </SelectItem>
                    {myGroups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Media URL Icons */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggleMediaInput("youtube")}
                          className={cn(
                            "p-2 rounded-full transition-all duration-200",
                            activeMediaInputs.has("youtube")
                              ? "bg-red-500/15 text-red-500 scale-110"
                              : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          )}
                        >
                          <Youtube className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>YouTube</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggleMediaInput("instagram")}
                          className={cn(
                            "p-2 rounded-full transition-all duration-200",
                            activeMediaInputs.has("instagram")
                              ? "bg-pink-500/15 text-pink-500 scale-110"
                              : "text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10"
                          )}
                        >
                          <Instagram className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Instagram</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggleMediaInput("facebook")}
                          className={cn(
                            "p-2 rounded-full transition-all duration-200",
                            activeMediaInputs.has("facebook")
                              ? "bg-blue-500/15 text-blue-500 scale-110"
                              : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                          )}
                        >
                          <Facebook className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Facebook</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label
                          className={cn(
                            "p-2 rounded-full transition-all duration-200 cursor-pointer",
                            postImagePreview
                              ? "bg-emerald-500/15 text-emerald-500 scale-110"
                              : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                          )}
                        >
                          <ImagePlus className="h-5 w-5" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                        </label>
                      </TooltipTrigger>
                      <TooltipContent>Anexar Imagem</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid gap-2">
                    {activeMediaInputs.has("youtube") && (
                      <div className="relative animate-fade-in">
                        <Youtube className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                        <Input placeholder="Cole o link do YouTube" value={postYoutube} onChange={(e) => setPostYoutube(e.target.value)} className="pl-9 text-xs h-9" />
                      </div>
                    )}
                    {activeMediaInputs.has("instagram") && (
                      <div className="relative animate-fade-in">
                        <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                        <Input placeholder="Cole o link do Instagram" value={postInstagram} onChange={(e) => setPostInstagram(e.target.value)} className="pl-9 text-xs h-9" />
                      </div>
                    )}
                    {activeMediaInputs.has("facebook") && (
                      <div className="relative animate-fade-in">
                        <Facebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                        <Input placeholder="Cole o link do Facebook" value={postFacebook} onChange={(e) => setPostFacebook(e.target.value)} className="pl-9 text-xs h-9" />
                      </div>
                    )}
                  </div>
                  {/* Image preview */}
                  {postImagePreview && (
                    <div className="relative animate-fade-in inline-block">
                      <img src={postImagePreview} alt="Preview" className="max-h-40 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPostImageFile(null); setPostImagePreview(null); }}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs shadow-md"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{postText.length}/1000</span>
                  <Button
                    size="sm"
                    disabled={!postText.trim() || createPostMutation.isPending || uploadingImage}
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
            )
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          {/* Sub-tabs: Avisos / Repertórios */}
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
                  {filteredPosts.map((post) => {
                    const ytId = post.youtube_url ? extractYouTubeId(post.youtube_url) : null;
                    const isOwner = user?.id === post.user_id;
                    const wasEdited = !!post.updated_at && post.updated_at !== post.created_at;

                    return (
                      <div key={post.id} className="rounded-xl border border-border bg-card p-4 space-y-3 transition-all hover:border-primary/20">
                        {/* Author + Actions */}
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={post.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{getInitials(post.profiles)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{getAuthorName(post.profiles)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                              {wasEdited && <span className="ml-1 italic">(editado)</span>}
                            </p>
                          </div>
                          {(isOwner || isAdmin) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {isOwner && (
                                  <>
                                    <DropdownMenuItem onClick={() => openEditModal(post)} className="gap-2">
                                      <Pencil className="h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDeleteTarget({ id: post.id })} className="gap-2 text-destructive focus:text-destructive">
                                      <Trash2 className="h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isAdmin && !isOwner && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteTarget({ id: post.id, isAdmin: true })} className="gap-2 text-destructive focus:text-destructive">
                                      <ShieldAlert className="h-4 w-4" /> 🛡️ Excluir (Admin)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => banUserMutation.mutate(post.user_id)} className="gap-2 text-destructive focus:text-destructive">
                                      <Ban className="h-4 w-4" /> 🔨 Banir Usuário
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isAdmin && isOwner && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled className="gap-2 text-muted-foreground text-xs">
                                      <ShieldAlert className="h-4 w-4" /> Você é o autor
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                          {post.content}
                        </p>

                        {post.image_url && (
                          <div className="rounded-lg overflow-hidden border border-border animate-fade-in">
                            <img src={post.image_url} alt="Imagem do post" className="w-full max-h-96 object-cover" loading="lazy" />
                          </div>
                        )}

                        {post.setlist_id && post.setlist && (
                          <SetlistRichCard setlistId={post.setlist.id} setlistName={post.setlist.name} songCount={post.setlist.setlist_items?.length} showDate={post.setlist.show_date} showTime={post.setlist.start_time} ownerId={post.setlist.user_id} ownerName={getAuthorName(post.profiles)} />
                        )}

                        {ytId && (
                          <div className="rounded-lg overflow-hidden border border-border">
                            <iframe
                              className="w-full aspect-video"
                              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title="YouTube"
                            />
                          </div>
                        )}

                        {(post.instagram_url || post.facebook_url) && (
                          <div className="flex items-center gap-2">
                            {post.instagram_url && (
                              <a href={post.instagram_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-pink-500 border-pink-500/30 hover:bg-pink-500/10">
                                  <Instagram className="h-3.5 w-3.5" /> Instagram
                                </Button>
                              </a>
                            )}
                            {post.facebook_url && (
                              <a href={post.facebook_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-blue-500 border-blue-500/30 hover:bg-blue-500/10">
                                  <Facebook className="h-3.5 w-3.5" /> Facebook
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
        </TabsContent>

        {/* ══════ MEUS GRUPOS TAB ══════ */}
        <TabsContent value="grupos" className="mt-4 space-y-4">
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Grupos dos quais você participa</p>
                <CreateGroupModal />
              </div>

              {myGroups.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">Você ainda não faz parte de nenhum grupo.</p>
                  <p className="text-muted-foreground text-xs">Crie um grupo ou peça para ser convidado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myGroups.map((g: any) => (
                    <button
                      key={g.id}
                      onClick={() => setActiveGroup({ id: g.id, name: g.name, isCreator: g.isCreator })}
                      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{g.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {g.isCreator ? "Criado por você" : "Membro"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 space-y-2">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">Faça login para ver seus grupos.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Comments Sheet */}
      {activeSetlist && (
        <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} setlistId={activeSetlist.id} setlistName={activeSetlist.name} />
      )}

      {/* Edit Post Modal */}
      <Dialog open={!!editPost} onOpenChange={(o) => { if (!o) setEditPost(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Postagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={1000}
              rows={4}
              className="resize-none bg-background"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="relative">
                <Youtube className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                <Input placeholder="YouTube" value={editYoutube} onChange={(e) => setEditYoutube(e.target.value)} className="pl-9 text-xs h-9" />
              </div>
              <div className="relative">
                <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                <Input placeholder="Instagram" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} className="pl-9 text-xs h-9" />
              </div>
              <div className="relative">
                <Facebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                <Input placeholder="Facebook" value={editFacebook} onChange={(e) => setEditFacebook(e.target.value)} className="pl-9 text-xs h-9" />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">{editText.length}/1000</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPost(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editText.trim() || updatePostMutation.isPending}>
              {updatePostMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) deletePostMutation.mutate(deleteTarget.id); }}
        title="Excluir postagem"
        description={deleteTarget?.isAdmin ? "Excluir esta postagem como moderador? Esta ação não pode ser desfeita." : "Tem certeza de que deseja excluir esta postagem?"}
      />
    </div>
  );
}
