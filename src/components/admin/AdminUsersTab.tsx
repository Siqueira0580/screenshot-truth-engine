import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { toast } from "@/components/ui/sonner";
import { Users, Crown, Music, MoreVertical, Award, Ban, Search, X, UserX, ShieldCheck, ShieldOff, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserLoginHistorySheet from "@/components/admin/UserLoginHistorySheet";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_instrument: string;
  subscription_plan: string;
  pro_expires_at: string | null;
  created_at: string;
}

export default function AdminUsersTab() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [lastLoginByUser, setLastLoginByUser] = useState<Record<string, string>>({});
  const [historyTarget, setHistoryTarget] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  const [totalUsers, setTotalUsers] = useState(0);
  const [proUsers, setProUsers] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);

  const filtered = profiles.filter((p) => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      (p.first_name?.toLowerCase().includes(term)) ||
      (p.last_name?.toLowerCase().includes(term)) ||
      (p.email?.toLowerCase().includes(term));
    const matchesPlan = planFilter === "all" || p.subscription_plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, songsRes, rolesRes, loginsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url, preferred_instrument, subscription_plan, pro_expires_at, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("songs").select("id", { count: "exact", head: true }),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase
        .from("user_login_logs")
        .select("user_id, login_at")
        .order("login_at", { ascending: false })
        .limit(1000),
    ]);

    const data = profilesRes.data ?? [];
    setProfiles(data);
    setTotalUsers(data.length);
    setProUsers(data.filter((p) => p.subscription_plan === "pro").length);
    setTotalSongs(songsRes.count ?? 0);
    setAdminUserIds(new Set((rolesRes.data ?? []).map((r) => r.user_id)));

    // Reduce login rows to latest login per user
    const lastMap: Record<string, string> = {};
    for (const row of (loginsRes.data ?? []) as Array<{ user_id: string; login_at: string }>) {
      if (!lastMap[row.user_id]) lastMap[row.user_id] = row.login_at;
    }
    setLastLoginByUser(lastMap);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRoleChange = async (profile: Profile, makeAdmin: boolean) => {
    if (profile.id === currentUser?.id) return;

    if (makeAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: profile.id, role: "admin" as const }, { onConflict: "user_id,role" });
      if (error) { toast.error("Erro ao promover a Admin."); return; }
      setAdminUserIds((prev) => new Set(prev).add(profile.id));
      toast.success(`${profile.email} promovido a Admin.`);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", profile.id)
        .eq("role", "admin" as const);
      if (error) { toast.error("Erro ao remover Admin."); return; }
      setAdminUserIds((prev) => { const s = new Set(prev); s.delete(profile.id); return s; });
      toast.success(`Admin removido de ${profile.email}.`);
    }
  };

  const grantPro = async (profile: Profile) => {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_plan: "pro", pro_expires_at: expiresAt.toISOString() })
      .eq("id", profile.id);
    if (error) toast.error("Erro ao conceder PRO.");
    else { toast.success(`PRO concedido a ${profile.email}.`); fetchAll(); }
  };

  const revokePro = async (profile: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_plan: "free", pro_expires_at: null })
      .eq("id", profile.id);
    if (error) toast.error("Erro ao revogar PRO.");
    else { toast.success(`PRO revogado de ${profile.email}.`); fetchAll(); }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    const { error } = await supabase.from("profiles").delete().eq("id", suspendTarget.id);
    if (error) toast.error("Erro ao suspender conta.");
    else { toast.success("Conta suspensa com sucesso."); fetchAll(); }
    setSuspendTarget(null);
  };

  const kpis = [
    { label: "Total Utilizadores", value: totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Utilizadores PRO", value: proUsers, icon: Crown, color: "text-amber-500" },
    { label: "Músicas no App", value: totalSongs, icon: Music, color: "text-emerald-500" },
  ];

  const isSelf = (id: string) => id === currentUser?.id;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {kpis.map((k) => (
            <Card key={k.label} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "—" : k.value.toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="border-border">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Utilizadores ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-56"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">PRO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">A carregar...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizador</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Último acesso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const isAdmin = adminUserIds.has(p.id);
                      const self = isSelf(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={p.avatar_url ?? undefined} alt={p.first_name ?? ""} />
                                <AvatarFallback className="text-xs">
                                  {(p.first_name?.[0] ?? "").toUpperCase()}{(p.last_name?.[0] ?? "").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{p.email ?? "—"}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Badge className="gap-1 bg-blue-600 hover:bg-blue-700 text-white border-transparent">
                                <ShieldCheck className="h-3 w-3" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                User
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.subscription_plan === "pro" ? "default" : "secondary"} className="capitalize">
                              {p.subscription_plan}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {/* Role actions */}
                                {isAdmin ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <DropdownMenuItem
                                          disabled={self}
                                          onClick={() => handleRoleChange(p, false)}
                                          className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                                        >
                                          <ShieldOff className="h-4 w-4" /> Remover Admin
                                        </DropdownMenuItem>
                                      </div>
                                    </TooltipTrigger>
                                    {self && (
                                      <TooltipContent>
                                        Você não pode remover o seu próprio acesso de administrador.
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleRoleChange(p, true)} className="gap-2 cursor-pointer">
                                    <ShieldCheck className="h-4 w-4" /> Tornar Admin
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {/* PRO actions */}
                                {p.subscription_plan === "pro" ? (
                                  <DropdownMenuItem onClick={() => revokePro(p)} className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600">
                                    <UserX className="h-4 w-4" /> Revogar PRO
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => grantPro(p)} className="gap-2 cursor-pointer">
                                    <Award className="h-4 w-4" /> Conceder PRO
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <DropdownMenuItem
                                        disabled={self}
                                        onClick={() => setSuspendTarget(p)}
                                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                      >
                                        <Ban className="h-4 w-4" /> Suspender Conta
                                      </DropdownMenuItem>
                                    </div>
                                  </TooltipTrigger>
                                  {self && (
                                    <TooltipContent>
                                      Você não pode suspender a sua própria conta.
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <ConfirmDeleteModal
              open={!!suspendTarget}
              onOpenChange={(open) => !open && setSuspendTarget(null)}
              onConfirm={handleSuspend}
              title="Suspender conta"
              description={`Tem a certeza de que deseja suspender a conta de "${suspendTarget?.email ?? ""}"? Esta ação não pode ser desfeita.`}
            />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
