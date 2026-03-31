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
import { ArrowLeft, Megaphone, Settings, Youtube, Instagram, Facebook, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import GroupManageModal from "./GroupManageModal";
import SetlistRichCard from "./SetlistRichCard";

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
        .select("id, user_id, content, created_at, updated_at, youtube_url, instagram_url, facebook_url, image_url, setlist_id, profiles:user_id(first_name, last_name, avatar_url), setlist:setlist_id(id, name)")
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
              <button
                type="button"
                onClick={() => toggleMediaInput("youtube")}
                className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  activeMediaInputs.has("youtube")
                    ? "bg-red-500/15 text-red-500 scale-110"
                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                )}
                title="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => toggleMediaInput("instagram")}
                className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  activeMediaInputs.has("instagram")
                    ? "bg-pink-500/15 text-pink-500 scale-110"
                    : "text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10"
                )}
                title="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => toggleMediaInput("facebook")}
                className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  activeMediaInputs.has("facebook")
                    ? "bg-blue-500/15 text-blue-500 scale-110"
                    : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                )}
                title="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </button>
              <label
                className={cn(
                  "p-2 rounded-full transition-all duration-200 cursor-pointer",
                  postImagePreview
                    ? "bg-emerald-500/15 text-emerald-500 scale-110"
                    : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                )}
                title="Anexar Imagem"
              >
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
              disabled={!postText.trim() || createMutation.isPending || uploadingImage}
              onClick={handlePublish}
              className="gap-1.5"
            >
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
            return (
              <div key={post.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={post.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{getInitials(post.profiles)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{getAuthorName(post.profiles)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
                {post.image_url && (
                  <div className="rounded-lg overflow-hidden border border-border animate-fade-in">
                    <img src={post.image_url} alt="Imagem do post" className="w-full max-h-96 object-cover" loading="lazy" />
                  </div>
                )}
                {post.setlist_id && post.setlist && (
                  <SetlistRichCard setlistId={post.setlist.id} setlistName={post.setlist.name} />
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
