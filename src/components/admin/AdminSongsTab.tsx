import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Music, ListMusic, Eye, Trash2, Search } from "lucide-react";

interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  created_at: string;
  created_by: string | null;
  access_count: number | null;
  creator_name?: string;
}

interface DeletionLog {
  id: string;
  song_id: string;
  title: string | null;
  artist: string | null;
  deleted_by: string | null;
  deleted_by_email: string | null;
  deleted_at: string;
  deleter_name?: string;
}

interface SetlistCount {
  song_id: string;
  count: number;
}

const PAGE_SIZE = 50;

export default function AdminSongsTab() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [deletions, setDeletions] = useState<DeletionLog[]>([]);
  const [setlistCounts, setSetlistCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const [songsRes, itemsRes, delRes] = await Promise.all([
        supabase.from("songs").select("id, title, artist, created_at, created_by, access_count").order("created_at", { ascending: false }).limit(1000),
        supabase.from("setlist_items").select("song_id").limit(10000),
        supabase.from("song_deletion_logs").select("*").order("deleted_at", { ascending: false }).limit(500),
      ]);

      const counts: Record<string, number> = {};
      (itemsRes.data ?? []).forEach((i: any) => {
        if (i.song_id) counts[i.song_id] = (counts[i.song_id] ?? 0) + 1;
      });
      setSetlistCounts(counts);

      const songsData = (songsRes.data ?? []) as SongRow[];
      const delData = (delRes.data ?? []) as DeletionLog[];

      // Fetch creator/deleter names
      const ids = new Set<string>();
      songsData.forEach((s) => s.created_by && ids.add(s.created_by));
      delData.forEach((d) => d.deleted_by && ids.add(d.deleted_by));

      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", Array.from(ids));
        const nameMap: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => {
          nameMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—";
        });
        songsData.forEach((s) => { s.creator_name = s.created_by ? nameMap[s.created_by] : "—"; });
        delData.forEach((d) => { d.deleter_name = d.deleted_by ? nameMap[d.deleted_by] : (d.deleted_by_email ?? "—"); });
      }

      setSongs(songsData);
      setDeletions(delData);
      setLoading(false);
    })();
  }, []);

  const topSelected = useMemo(() => {
    return songs
      .map((s) => ({ name: s.title, value: setlistCounts[s.id] ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [songs, setlistCounts]);

  const topViewed = useMemo(() => {
    return songs
      .map((s) => ({ name: s.title, value: s.access_count ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [songs]);

  const totalSelections = useMemo(
    () => Object.values(setlistCounts).reduce((a, b) => a + b, 0),
    [setlistCounts]
  );
  const totalViews = useMemo(
    () => songs.reduce((a, s) => a + (s.access_count ?? 0), 0),
    [songs]
  );

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.artist ?? "").toLowerCase().includes(q)
    );
  }, [songs, search]);

  const filteredDeletions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deletions;
    return deletions.filter(
      (d) => (d.title ?? "").toLowerCase().includes(q) || (d.artist ?? "").toLowerCase().includes(q)
    );
  }, [deletions, search]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  // Infinite scroll observer
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredSongs.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredSongs.length, visibleCount, loading]);

  if (loading) return <p className="text-muted-foreground text-sm">A carregar...</p>;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Músicas no Sistema" value={songs.length} icon={Music} color="text-emerald-500" />
        <StatCard label="Inclusões em Repertórios" value={totalSelections} icon={ListMusic} color="text-amber-500" />
        <StatCard label="Total de Visualizações" value={totalViews} icon={Eye} color="text-blue-500" />
        <StatCard label="Exclusões Registadas" value={deletions.length} icon={Trash2} color="text-red-500" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListMusic className="h-4 w-4 text-amber-500" /> Top 10 mais incluídas em repertórios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSelected.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSelected} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" /> Top 10 mais visualizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topViewed.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topViewed} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por título ou artista..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Songs list */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Músicas Incluídas no Sistema ({filteredSongs.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Artista</TableHead>
                <TableHead>Adicionada por</TableHead>
                <TableHead>Data de inclusão</TableHead>
                <TableHead className="text-right">Repertórios</TableHead>
                <TableHead className="text-right">Visualizações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSongs.slice(0, visibleCount).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell className="text-muted-foreground">{s.artist ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.creator_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(s.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{setlistCounts[s.id] ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.access_count ?? 0}</TableCell>
                </TableRow>
              ))}
              {filteredSongs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhuma música encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {visibleCount < filteredSongs.length && (
            <div ref={loadMoreRef} className="py-4 text-center text-xs text-muted-foreground">
              A carregar mais... ({visibleCount} de {filteredSongs.length})
            </div>
          )}
          {visibleCount >= filteredSongs.length && filteredSongs.length > PAGE_SIZE && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {filteredSongs.length} músicas carregadas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deletions log */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" /> Histórico de Exclusões ({filteredDeletions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredDeletions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              Nenhuma exclusão registada. Exclusões futuras aparecerão aqui.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Artista</TableHead>
                  <TableHead>Excluída por</TableHead>
                  <TableHead>Data de exclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeletions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.artist ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.deleter_name ?? d.deleted_by_email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(d.deleted_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
