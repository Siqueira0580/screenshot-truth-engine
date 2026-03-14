import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp } from "lucide-react";

const PLAN_PRICE = 19.90; // Valor mensal base do plano PRO

interface ProUser {
  id: string;
  email: string | null;
  first_name: string | null;
  subscription_plan: string;
  pro_expires_at: string | null;
}

export default function AdminFinancialTab() {
  const [proUsers, setProUsers] = useState<ProUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, subscription_plan, pro_expires_at")
        .eq("subscription_plan", "pro")
        .order("pro_expires_at", { ascending: false });
      setProUsers(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const mrr = proUsers.length * PLAN_PRICE;

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
              {proUsers.length} assinante{proUsers.length !== 1 ? "s" : ""} × R$ {PLAN_PRICE.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinantes Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "—" : proUsers.length}
            </div>
          </CardContent>
        </Card>
      </div>

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
