import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const PLAN_PRICE_MONTHLY = 14.90;

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  subscription_plan: string;
  pro_expires_at: string | null;
  created_at: string;
}

function getWeekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return `${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1).toString().padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[date.getMonth()]} ${date.getFullYear().toString().slice(2)}`;
}

export default function AdminFinancialTab() {
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, subscription_plan, pro_expires_at, created_at")
        .order("created_at", { ascending: true });
      setAllProfiles(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const proUsers = useMemo(() => allProfiles.filter((p) => p.subscription_plan === "pro"), [allProfiles]);
  const mrr = proUsers.length * PLAN_PRICE_MONTHLY;

  // --- Chart: New users per week (last 12 weeks) ---
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      weeks.push({ label: getWeekLabel(start), start, end });
    }
    return weeks.map((w) => ({
      semana: w.label,
      novos: allProfiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= w.start && d <= w.end;
      }).length,
    }));
  }, [allProfiles]);

  // --- Chart: Monthly revenue (last 6 months) ---
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: getMonthLabel(d), year: d.getFullYear(), month: d.getMonth() });
    }
    return months.map((m) => {
      // Count pro users whose pro_expires_at is after the start of this month
      const proCount = proUsers.filter((u) => {
        if (!u.pro_expires_at) return false;
        const exp = new Date(u.pro_expires_at);
        const created = new Date(u.created_at);
        const monthStart = new Date(m.year, m.month, 1);
        const monthEnd = new Date(m.year, m.month + 1, 0, 23, 59, 59);
        return created <= monthEnd && exp >= monthStart;
      }).length;
      return {
        mês: m.label,
        receita: +(proCount * PLAN_PRICE_MONTHLY).toFixed(2),
      };
    });
  }, [proUsers]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : `R$ ${mrr.toFixed(2).replace(".", ",")}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {proUsers.length} × R$ {PLAN_PRICE_MONTHLY.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinantes PRO</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{loading ? "—" : proUsers.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Utilizadores</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{loading ? "—" : allProfiles.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {!loading && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* New Users per Week */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Novos Utilizadores por Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="novos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Receita Mensal Estimada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mês" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2).replace(".", ",")}`, "Receita"]}
                    />
                    <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Últimas Atualizações de Plano</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">A carregar...</p>
          ) : proUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum assinante PRO encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proUsers.map((u) => {
                    const expired = u.pro_expires_at && new Date(u.pro_expires_at) < new Date();
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.first_name || "—"}</TableCell>
                        <TableCell>{u.email ?? "—"}</TableCell>
                        <TableCell>
                          {u.pro_expires_at
                            ? new Date(u.pro_expires_at).toLocaleDateString("pt-BR")
                            : "Sem data"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={expired ? "destructive" : "default"}>
                            {expired ? "Expirado" : "Aprovado"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
