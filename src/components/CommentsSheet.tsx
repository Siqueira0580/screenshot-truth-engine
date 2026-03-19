import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistId: string;
  setlistName: string;
}

interface Comment {
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

export default function CommentsSheet({ open, onOpenChange, setlistId, setlistName }: CommentsSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["setlist-comments", setlistId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_comments")
        .select("id, user_id, content, created_at, profiles:user_id(first_name, last_name, avatar_url)")
        .eq("setlist_id", setlistId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        profiles: Array.isArray(c.profiles) ? c.profiles[0] || null : c.profiles,
      })) as Comment[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("setlist_comments")
        .insert({ setlist_id: setlistId, user_id: user!.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["setlist-comments", setlistId] });
      queryClient.invalidateQueries({ queryKey: ["community-comments-count"] });
    },
    onError: () => toast.error("Erro ao enviar comentário"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("setlist_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-comments", setlistId] });
      queryClient.invalidateQueries({ queryKey: ["community-comments-count"] });
    },
    onError: () => toast.error("Erro ao apagar comentário"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || !user) return;
    if (trimmed.length > 500) {
      toast.error("Comentário deve ter no máximo 500 caracteres");
      return;
    }
    addMutation.mutate(trimmed);
  };

  const getInitials = (p: Comment["profiles"]) => {
    if (!p) return "?";
    return [p.first_name, p.last_name].filter(Boolean).map((n) => n![0]?.toUpperCase()).join("") || "?";
  };

  const getName = (p: Comment["profiles"]) => {
    if (!p) return "Anônimo";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Anônimo";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Comentários
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate">{setlistName}</p>
        </SheetHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum comentário ainda. Seja o primeiro!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                    {getInitials(comment.profiles)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {getName(comment.profiles)}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-0.5 break-words">{comment.content}</p>
                </div>
                {user?.id === comment.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(comment.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        {user && (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border px-4 py-3">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escreva um comentário..."
              maxLength={500}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || addMutation.isPending}
              className="shrink-0 gap-1.5"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
