import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { toast } from "@/components/ui/sonner";
import { Trash2, Pencil, Plus } from "lucide-react";

interface GlobalSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  updated_at: string;
}

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState<GlobalSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GlobalSetting | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("global_settings").select("*").order("setting_key");
    if (error) toast.error("Erro ao carregar configurações.");
    else setSettings(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    const { error } = await supabase.from("global_settings").insert({ setting_key: newKey.trim(), setting_value: newValue.trim() || null });
    if (error) toast.error(error.message.includes("duplicate") ? "Chave já existe." : "Erro ao adicionar.");
    else { toast.success("Configuração adicionada."); setNewKey(""); setNewValue(""); fetchSettings(); }
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("global_settings").update({ setting_value: editValue.trim() || null }).eq("id", id);
    if (error) toast.error("Erro ao atualizar.");
    else { toast.success("Configuração atualizada."); setEditingId(null); fetchSettings(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("global_settings").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Configuração excluída."); fetchSettings(); }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Configurações Globais</h2>
      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-6">
          {/* Add new */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-key" className="text-xs">Chave</Label>
              <Input id="new-key" placeholder="ex: max_upload_size" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-value" className="text-xs">Valor</Label>
              <Input id="new-value" placeholder="ex: 10MB" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={!newKey.trim()} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">A carregar...</p>
          ) : settings.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma configuração registada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Atualizado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.setting_key}</TableCell>
                      <TableCell>
                        {editingId === s.id ? (
                          <div className="flex gap-2">
                            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8" autoFocus onKeyDown={(e) => e.key === "Enter" && handleUpdate(s.id)} />
                            <Button size="sm" onClick={() => handleUpdate(s.id)}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{s.setting_value ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.updated_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(s.id); setEditValue(s.setting_value ?? ""); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}>
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
            title="Excluir configuração"
            description={`Tem a certeza de que deseja excluir a chave "${deleteTarget?.setting_key ?? ""}"?`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
