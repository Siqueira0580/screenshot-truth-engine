import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Music, ListMusic, PenTool } from "lucide-react";

interface Stats {
  users: number;
  songs: number;
  setlists: number;
  compositions: number;
}

export default function AdminOverviewTab() {
  const [stats, setStats] = useState<Stats>({ users: 0, songs: 0, setlists: 0, compositions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [users, songs, setlists, compositions] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("setlists").select("id", { count: "exact", head: true }),
        supabase.from("compositions").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        users: users.count ?? 0,
        songs: songs.count ?? 0,
        setlists: setlists.count ?? 0,
        compositions: compositions.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Utilizadores", value: stats.users, icon: Users, color: "text-blue-500" },
    { label: "Músicas", value: stats.songs, icon: Music, color: "text-emerald-500" },
    { label: "Repertórios", value: stats.setlists, icon: ListMusic, color: "text-amber-500" },
    { label: "Composições", value: stats.compositions, icon: PenTool, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Visão Geral</h2>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? "—" : c.value.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
