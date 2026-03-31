import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export default function ChatPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load other user's profile
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) setOtherProfile(data);
      });
  }, [userId]);

  // Load message history
  useEffect(() => {
    if (!user || !userId) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar mensagens");
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    loadMessages();

    // Mark unread messages as read
    supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("sender_id", userId)
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .then();
  }, [user, userId]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !userId) return;

    const channel = supabase
      .channel(`dm-${user.id}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const msg = payload.new as Message;
          // Only add if it belongs to this conversation
          const isRelevant =
            (msg.sender_id === user.id && msg.receiver_id === userId) ||
            (msg.sender_id === userId && msg.receiver_id === user.id);
          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Mark as read if we're the receiver
            if (msg.receiver_id === user.id) {
              supabase
                .from("direct_messages")
                .update({ is_read: true })
                .eq("id", msg.id)
                .then();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !user || !userId || sending) return;

    setSending(true);
    setNewMessage("");

    // Optimistic add
    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      receiver_id: userId,
      content: trimmed,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, receiver_id: userId, content: trimmed });

    if (error) {
      // Rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      toast.error("Erro ao enviar mensagem");
    } else {
      // Send notification to receiver
      const senderName = otherProfile
        ? [otherProfile.first_name, otherProfile.last_name].filter(Boolean).join(" ") || "Alguém"
        : "Alguém";
      // We need our own name for the notification
      const { data: myProfile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single();
      const myName = myProfile ? [myProfile.first_name, myProfile.last_name].filter(Boolean).join(" ") || "Alguém" : "Alguém";
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "direct_message",
        title: `Nova mensagem de ${myName}`,
        body: trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed,
        metadata: { sender_id: user.id },
      } as any);
    }
    setSending(false);
  };

  const getName = (p: Profile | null) => {
    if (!p) return "Utilizador";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Utilizador";
  };

  const getInitials = (p: Profile | null) => {
    if (!p) return "?";
    return [p.first_name, p.last_name].filter(Boolean).map((n) => n![0]?.toUpperCase()).join("") || "?";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card rounded-t-xl">
        <Link to="/mensagens" className="shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={otherProfile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
            {getInitials(otherProfile)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{getName(otherProfile)}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Diga olá! 👋
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card rounded-b-xl">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escreva uma mensagem..."
          maxLength={2000}
          className="flex-1"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newMessage.trim() || sending}
          className="shrink-0 gap-1.5"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
