import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { Bell, Check, Users, MessageSquare, Heart, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  group_invite: Users,
  direct_message: MessageSquare,
  setlist_comment: MessageCircle,
  setlist_like: Heart,
};

function getNotificationRoute(n: Notification): string | null {
  const meta = n.metadata as Record<string, string> | null;
  switch (n.type) {
    case "direct_message":
      return meta?.sender_id ? `/chat/${meta.sender_id}` : null;
    case "setlist_comment":
    case "setlist_like":
      return meta?.setlist_id ? `/setlists/${meta.setlist_id}` : null;
    case "group_invite":
      return "/community";
    default:
      return null;
  }
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    const route = getNotificationRoute(n);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-0">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notificações</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => markAllAsRead.mutate()}
            >
              <Check className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sem notificações</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = iconMap[n.type] || Bell;
                const hasRoute = !!getNotificationRoute(n);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                      !n.is_read && "bg-primary/5",
                      hasRoute && "cursor-pointer"
                    )}
                  >
                    <div className={cn("mt-0.5 rounded-full p-1.5", !n.is_read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", !n.is_read && "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!n.is_read && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
