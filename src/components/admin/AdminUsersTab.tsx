import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { toast } from "@/components/ui/sonner";
import { Trash2 } from "lucide-react";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  preferred_instrument: string;
  created_at: string;
}

export default function AdminUsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, preferred_instrument, created_at")
      .order("created_at", { ascending: false });

    if (error) toast.error("Erro ao carregar utilizadores.");
    else setProfiles(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Erro ao excluir utilizador.");
    else { toast.success("Utilizador excluído."); fetchProfiles(); }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Gerir Utilizadores</h2>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Utilizadores ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">A carregar...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Instrumento</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell>{p.email ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.preferred_instrument}</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <ConfirmDeleteModal
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Excluir utilizador"
            description={`Tem a certeza de que deseja excluir o perfil de "${deleteTarget?.email ?? ""}"? Esta ação não pode ser desfeita.`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
