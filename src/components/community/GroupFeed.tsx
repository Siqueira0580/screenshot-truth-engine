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
import { ArrowLeft, Megaphone, Settings, Youtube, Instagram, Facebook, Link as LinkIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import GroupManageModal from "./GroupManageModal";

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
  const [showMediaInputs, setShowMediaInputs] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["group-posts", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, user_id, content, created_at, updated_at, youtube_url, instagram_url, facebook_url, profiles:user_id(first_name, last_name, avatar_url)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("community_posts").insert({
        user_id: user!.id,
        content: postText.trim(),
        group_id: groupId,
        youtube_url: postYoutube.trim() || null,
        instagram_url: postInstagram.trim() || null,
        facebook_url: postFacebook.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostText("");
      setPostYoutube("");
      setPostInstagram("");
      setPostFacebook("");
      toast.success("Publicação no grupo!");
      queryClient.invalidateQueries({ queryKey: ["group-posts", groupId] });
    },
    onError: () => toast.error("Erro ao publicar"),
  });

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
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMediaInputs(!showMediaInputs)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LinkIcon className="h-4 w-4" />
              Adicionar Links (YouTube, Insta, FB)
            </Button>
            {showMediaInputs && (
              <div className="grid gap-2 sm:grid-cols-3 mt-2">
                <div className="relative">
                  <Youtube className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  <Input placeholder="Link YouTube" value={postYoutube} onChange={(e) => setPostYoutube(e.target.value)} className="pl-9 text-xs h-9" />
                </div>
                <div className="relative">
                  <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                  <Input placeholder="Link Instagram" value={postInstagram} onChange={(e) => setPostInstagram(e.target.value)} className="pl-9 text-xs h-9" />
                </div>
                <div className="relative">
                  <Facebook className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                  <Input placeholder="Link Facebook" value={postFacebook} onChange={(e) => setPostFacebook(e.target.value)} className="pl-9 text-xs h-9" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{postText.length}/1000</span>
            <Button
              size="sm"
              disabled={!postText.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="gap-1.5"
            >
              <Megaphone className="h-4 w-4" />
              {createMutation.isPending ? "Publicando..." : "Publicar"}
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
