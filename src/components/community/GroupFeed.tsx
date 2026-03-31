import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, Megaphone, Settings, Youtube, Instagram, Facebook,
  ImagePlus, X, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import GroupManageModal from "./GroupManageModal";
import SetlistRichCard from "./SetlistRichCard";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Props {
  groupId: string;
  groupName: string;
  isCreator: boolean;
  onBack: () => void;
}

const getAuthorName = (p: any) => {
  if (!p) return "Anônimo";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Anônimo";
};
const getInitials = (p: any) => {
  if (!p) return "?";
  return [p.first_name, p.last_name].filter(Boolean).map((n: string) => n[0]?.toUpperCase()).join("") || "?";
};
const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
};

export default function GroupFeed({ groupId, groupName, isCreator, onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [postYoutube, setPostYoutube] = useState("");
  const [postInstagram, setPostInstagram] = useState("");
  const [postFacebook, setPostFacebook] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [activeMediaInputs, setActiveMediaInputs] = useState<Set<string>>(new Set());
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edit / Delete state
  const [editPost, setEditPost] = useState<any | null>(null);
  const [editText, setEditText] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const toggleMediaInput = (key: string) => {
    setActiveMediaInputs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["group-posts", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, user_id, content, created_at, updated_at, youtube_url, instagram_url, facebook_url, image_url, setlist_id, profiles:user_id(first_name, last_name, avatar_url), setlist:setlist_id(id, name, show_date, start_time, user_id, setlist_items(id))")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
        setlist: Array.isArray(p.setlist) ? p.setlist[0] || null : p.setlist,
      }));
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são permitidas"); return; }
    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const createMutation = useMutation({
    mutationFn: async (imageUrl: string | null) => {
      const { error } = await supabase.from("community_posts").insert({
        user_id: user!.id,
        content: postText.trim(),
        group_id: groupId,
        youtube_url: postYoutube.trim() || null,
        instagram_url: postInstagram.trim() || null,
        facebook_url: postFacebook.trim() || null,
        image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostText("");
      setPostYoutube("");
      setPostInstagram("");
      setPostFacebook("");
      setPostImageFile(null);
      setPostImagePreview(null);
      toast.success("Publicação no grupo!");
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] });
    },
    onError: () => toast.error("Erro ao publicar"),
  });

  const updateMutation = useMutation({
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
      toast.success("Publicação atualizada!");
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] });
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTargetId(null);
      toast.success("Publicação removida");
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] });
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const handlePublish = async () => {
    if (!postText.trim()) return;
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
    createMutation.mutate(imageUrl);
  };

  const openEditModal = (post: any) => {
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
    updateMutation.mutate({
      id: editPost.id,
      content: trimmed,
      youtube_url: editYoutube.trim() || undefined,
      instagram_url: editInstagram.trim() || undefined,
      facebook_url: editFacebook.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold flex-1 truncate">{groupName}</h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
          <Settings className="h-4 w-4" /> Gerir
        </Button>
      </div>

      {/* Post composer */}
      {user && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Escreva algo para o grupo..."
            maxLength={1000}
            rows={3}
            className="resize-none bg-background"
          />
          {/* Media URL Icons */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => toggleMediaInput("youtube")} className={cn("p-2 rounded-full transition-all duration-200", activeMediaInputs.has("youtube") ? "bg-red-500/15 text-red-500 scale-110" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10")} title="YouTube">
                <Youtube className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => toggleMediaInput("instagram")} className={cn("p-2 rounded-full transition-all duration-200", activeMediaInputs.has("instagram") ? "bg-pink-500/15 text-pink-500 scale-110" : "text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10")} title="Instagram">
                <Instagram className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => toggleMediaInput("facebook")} className={cn("p-2 rounded-full transition-all duration-200", activeMediaInputs.has("facebook") ? "bg-blue-500/15 text-blue-500 scale-110" : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10")} title="Facebook">
                <Facebook className="h-5 w-5" />
              </button>
              <label className={cn("p-2 rounded-full transition-all duration-200 cursor-pointer", postImagePreview ? "bg-emerald-500/15 text-emerald-500 scale-110" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10")} title="Anexar Imagem">
                <ImagePlus className="h-5 w-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
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
            {postImagePreview && (
              <div className="relative animate-fade-in inline-block">
                <img src={postImagePreview} alt="Preview" className="max-h-40 rounded-lg border border-border object-cover" />
                <button type="button" onClick={() => { setPostImageFile(null); setPostImagePreview(null); }} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs shadow-md">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{postText.length}/1000</span>
            <Button size="sm" disabled={!postText.trim() || createMutation.isPending || uploadingImage} onClick={handlePublish} className="gap-1.5">
              <Megaphone className="h-4 w-4" />
              {(createMutation.isPending || uploadingImage) ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>
      )}

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma publicação neste grupo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any) => {
            const ytId = post.youtube_url ? extractYouTubeId(post.youtube_url) : null;
            const isPostOwner = user?.id === post.user_id;
            return (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={post.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{getInitials(post.profiles)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{getAuthorName(post.profiles)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                      {post.updated_at && post.updated_at !== post.created_at && " (editado)"}
                    </p>
                  </div>
                  {isPostOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(post)} className="gap-2">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTargetId(post.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
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
                    <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${ytId}?rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="YouTube" />
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

      {/* Edit Modal */}
      <Dialog open={!!editPost} onOpenChange={(open) => { if (!open) setEditPost(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={1000} rows={4} className="resize-none" />
            <Input placeholder="Link do YouTube (opcional)" value={editYoutube} onChange={(e) => setEditYoutube(e.target.value)} className="text-xs h-9" />
            <Input placeholder="Link do Instagram (opcional)" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} className="text-xs h-9" />
            <Input placeholder="Link do Facebook (opcional)" value={editFacebook} onChange={(e) => setEditFacebook(e.target.value)} className="text-xs h-9" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPost(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editText.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteModal
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        onConfirm={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
        title="Excluir publicação"
        description="Tem a certeza de que deseja excluir esta publicação? Esta ação não pode ser desfeita."
      />

      <GroupManageModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        groupId={groupId}
        groupName={groupName}
        isCreator={isCreator}
        onLeave={onBack}
      />
    </div>
  );
}
