import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, PenLine, Calendar, SortAsc, Loader2, Trash2, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Composition {
  id: string;
  title: string;
  style: string | null;
  musical_key: string | null;
  bpm: number | null;
  composers: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  shared_with_emails: string[] | null;
}

export default function CompositionsHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // RLS already filters: owner OR email in shared_with_emails
      const { data, error } = await supabase
        .from("compositions")
        .select("id, title, style, musical_key, bpm, composers, created_at, updated_at, user_id, shared_with_emails")
        .order("updated_at", { ascending: false });
      if (!error && data) setCompositions(data as Composition[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = compositions
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "created") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("compositions").delete().eq("id", deleteTarget);
    if (error) {
      toast.error("Erro ao apagar composição.");
    } else {
      setCompositions((prev) => prev.filter((c) => c.id !== deleteTarget));
      toast.success("Composição apagada.");
    }
    setDeleteTarget(null);
  };

  const isOwner = (comp: Composition) => comp.user_id === user?.id;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Cofre Criativo</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {compositions.length} composiç{compositions.length === 1 ? "ão" : "ões"} • Privado e seguro
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate("/compose")}>
          <Plus className="h-4 w-4" /> Nova Composição
        </Button>
      </div>

      {/* Search & Filter — only show if there are compositions */}
      {compositions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar composição por nome..."
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-48 bg-secondary border-border">
              <SortAsc className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais Recentes</SelectItem>
              <SelectItem value="az">Ordem Alfabética (A-Z)</SelectItem>
              <SelectItem value="created">Data de Criação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        /* ─── Empty State Premium ─── */
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <PenLine className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">O Seu Cofre Criativo</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {search
              ? "Nenhuma composição encontrada com esse termo."
              : "A sua prancheta está limpa. Comece a escrever o seu próximo sucesso. Tudo o que compor aqui é privado e seguro."}
          </p>
          {!search && (
            <Button className="gap-2" size="lg" onClick={() => navigate("/compose")}>
              <Plus className="h-4 w-4" /> Nova Composição
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((comp) => {
            const owned = isOwner(comp);
            return (
              <button
                key={comp.id}
                onClick={() => navigate(`/compose?id=${comp.id}`)}
                className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {comp.title || "Sem título"}
                    </h3>
                    {comp.composers && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        ✍️ {comp.composers}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!owned && (
                      <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
                        <Users className="h-3 w-3" /> Partilhado
                      </Badge>
                    )}
                    {owned && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteClick(comp.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {comp.musical_key && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {comp.musical_key}
                    </span>
                  )}
                  {comp.bpm && <span>{comp.bpm} BPM</span>}
                  {comp.style && <span>• {comp.style}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(comp.updated_at), "dd MMM yyyy, HH:mm", { locale: pt })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
        title="Apagar Composição"
        description="Tem certeza que deseja apagar esta composição? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
