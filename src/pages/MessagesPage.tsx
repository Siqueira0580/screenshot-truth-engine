import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import BackButton from "@/components/ui/BackButton";

interface Conversation {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadConversations();

    // Realtime: refresh on new messages
    const channel = supabase
      .channel("inbox-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            loadConversations();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadConversations() {
    if (!user) return;

    // Get all messages where user is sender or receiver
    const { data: messages, error } = await supabase
      .from("direct_messages")
      .select("sender_id, receiver_id, content, created_at, is_read")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error || !messages) {
      setLoading(false);
      return;
    }

    // Group by conversation partner
    const convMap = new Map<string, { lastMessage: string; lastMessageAt: string; unreadCount: number }>();
    for (const msg of messages) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!partnerId) continue;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        });
      }
      // Count unread from partner
      if (msg.sender_id !== user.id && !msg.is_read) {
        const c = convMap.get(partnerId)!;
        c.unreadCount++;
      }
    }

    if (convMap.size === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch profiles
    const partnerIds = Array.from(convMap.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", partnerIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const result: Conversation[] = partnerIds.map((pid) => {
      const c = convMap.get(pid)!;
      const p = profileMap.get(pid);
      return {
        userId: pid,
        firstName: p?.first_name || null,
        lastName: p?.last_name || null,
        avatarUrl: p?.avatar_url || null,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
      };
    });

    // Sort by last message time
    result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(result);
    setLoading(false);
  }

  const getName = (c: Conversation) => {
    return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Utilizador";
  };

  const getInitials = (c: Conversation) => {
    return [c.firstName, c.lastName].filter(Boolean).map((n) => n![0]?.toUpperCase()).join("") || "?";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mensagens</h1>
          <p className="text-muted-foreground text-sm">As suas conversas diretas</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">
            Nenhuma conversa ainda. Explore a comunidade e envie a primeira mensagem!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.userId}
              to={`/mensagens/${conv.userId}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/40 hover:shadow-sm group"
            >
              <Avatar className="h-11 w-11 border border-border shrink-0">
                <AvatarImage src={conv.avatarUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                  {getInitials(conv)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {getName(conv)}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
              </div>
              {conv.unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full shrink-0">
                  {conv.unreadCount}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
