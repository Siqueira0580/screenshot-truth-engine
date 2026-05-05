import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock, History, Loader2, Search, X } from "lucide-react";

interface LoginLog {
  id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface Props {
  userId: string | null;
  userLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 30;
type PeriodFilter = "all" | "7" | "30" | "90";

function formatDayHeader(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yesterday)) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(d);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function UserLoginHistorySheet({ userId, userLabel, open, onOpenChange }: Props) {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const sinceIso = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period, 10));
    return d.toISOString();
  }, [period]);

  useEffect(() => {
    if (!open || !userId) return;
    setPage(0);
    setLogs([]);
    setHasMore(false);
    setLoading(true);
    (async () => {
      let q = supabase
        .from("user_login_logs")
        .select("id, login_at, ip_address, user_agent")
        .eq("user_id", userId)
        .order("login_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (sinceIso) q = q.gte("login_at", sinceIso);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`ip_address.ilike.${term},user_agent.ilike.${term}`);
      }
      const { data, error } = await q;
      if (!error && data) {
        setLogs(data as LoginLog[]);
        setHasMore(data.length === PAGE_SIZE);
      }
      setLoading(false);
    })();
  }, [open, userId, sinceIso, search]);

  const loadMore = async () => {
    if (!userId || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const from = next * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("user_login_logs")
      .select("id, login_at, ip_address, user_agent")
      .eq("user_id", userId)
      .order("login_at", { ascending: false })
      .range(from, to);
    if (sinceIso) q = q.gte("login_at", sinceIso);
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      q = q.or(`ip_address.ilike.${term},user_agent.ilike.${term}`);
    }
    const { data, error } = await q;
    if (!error && data) {
      setLogs((prev) => [...prev, ...(data as LoginLog[])]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(next);
    }
    setLoadingMore(false);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { header: string; items: LoginLog[] }>();
    for (const log of logs) {
      const d = new Date(log.login_at);
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, { header: formatDayHeader(d), items: [] });
      map.get(key)!.items.push(log);
    }
    return Array.from(map.values());
  }, [logs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de acessos
          </SheetTitle>
          <SheetDescription>
            {userLabel ? `Logins de ${userLabel}` : "Logins do utilizador"}
          </SheetDescription>
        </SheetHeader>

        {/* Filtros */}
        <div className="mt-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por IP ou navegador…"
              className="pl-8 pr-8 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum acesso registrado.</p>
            </div>
          ) : (
            <>
              {grouped.map((group) => (
                <div key={group.header} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.header}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((log) => {
                      const d = new Date(log.login_at);
                      const fullDate = new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      }).format(d);
                      const time = new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit", minute: "2-digit",
                      }).format(d);
                      return (
                        <li
                          key={log.id}
                          className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
                        >
                          <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {fullDate} às {time}
                            </p>
                            {(log.ip_address || log.user_agent) && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {log.ip_address ? `IP ${log.ip_address}` : ""}
                                {log.ip_address && log.user_agent ? " · " : ""}
                                {log.user_agent ?? ""}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
