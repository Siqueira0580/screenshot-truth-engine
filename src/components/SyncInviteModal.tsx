import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Copy, Check, Loader2, Plus, X, Users, Save, Trash2, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SyncInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistId: string;
  setlistName: string;
}

interface BroadcastGroup {
  id: string;
  name: string;
  members: { id: string; email: string; name: string | null }[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SyncInviteModal({
  open, onOpenChange, setlistId, setlistName,
}: SyncInviteModalProps) {
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<{ email: string; link: string }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Groups
  const [groups, setGroups] = useState<BroadcastGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [showSaveGroup, setShowSaveGroup] = useState(false);

  // Edit mode
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editEmails, setEditEmails] = useState<string[]>([]);
  const [editEmailInput, setEditEmailInput] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const { data: groupsData } = await supabase
      .from("broadcast_groups")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    if (!groupsData) return;

    const groupsWithMembers: BroadcastGroup[] = [];
    for (const g of groupsData) {
      const { data: members } = await supabase
        .from("broadcast_group_members")
        .select("id, email, name")
        .eq("group_id", g.id)
        .order("email");
      groupsWithMembers.push({ ...g, members: members || [] });
    }
    setGroups(groupsWithMembers);
  }, [user]);

  useEffect(() => {
    if (open) {
      loadGroups();
      setInviteLinks([]);
      setEditingGroupId(null);
    }
  }, [open, loadGroups]);

  // Add email to invite list
  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_REGEX.test(trimmed)) { toast.error("E-mail inválido"); return; }
    if (emails.includes(trimmed)) { toast.error("E-mail já adicionado"); return; }
    setEmails((prev) => [...prev, trimmed]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  // Load group emails into invite list
  const loadGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedGroupId(groupId);
    const newEmails = group.members.map((m) => m.email);
    setEmails((prev) => Array.from(new Set([...prev, ...newEmails])));
    toast.success(`Grupo "${group.name}" carregado (${newEmails.length} emails)`);
  };

  // Save current emails as new group
  const saveAsGroup = async () => {
    if (!user || !newGroupName.trim() || emails.length === 0) return;
    setSavingGroup(true);
    try {
      const { data: group, error } = await supabase
        .from("broadcast_groups")
        .insert({ user_id: user.id, name: newGroupName.trim() })
        .select("id")
        .single();
      if (error) throw error;

      const members = emails.map((email) => ({ group_id: group.id, email, name: null }));
      const { error: memError } = await supabase.from("broadcast_group_members").insert(members);
      if (memError) throw memError;

      toast.success(`Grupo "${newGroupName.trim()}" salvo!`);
      setNewGroupName("");
      setShowSaveGroup(false);
      loadGroups();
    } catch (err: any) {
      toast.error("Erro ao salvar grupo: " + (err.message || ""));
    } finally {
      setSavingGroup(false);
    }
  };

  // Delete group
  const deleteGroup = async (groupId: string) => {
    const { error } = await supabase.from("broadcast_groups").delete().eq("id", groupId);
    if (error) { toast.error("Erro ao excluir grupo"); return; }
    toast.success("Grupo excluído");
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    if (editingGroupId === groupId) setEditingGroupId(null);
    loadGroups();
  };

  // --- Edit group ---
  const startEditGroup = (group: BroadcastGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditEmails(group.members.map((m) => m.email));
    setEditEmailInput("");
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditGroupName("");
    setEditEmails([]);
    setEditEmailInput("");
  };

  const addEditEmail = () => {
    const trimmed = editEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_REGEX.test(trimmed)) { toast.error("E-mail inválido"); return; }
    if (editEmails.includes(trimmed)) { toast.error("E-mail já existe no grupo"); return; }
    setEditEmails((prev) => [...prev, trimmed]);
    setEditEmailInput("");
  };

  const removeEditEmail = (email: string) => {
    setEditEmails((prev) => prev.filter((e) => e !== email));
  };

  const saveEditGroup = async () => {
    if (!editingGroupId || !editGroupName.trim() || editEmails.length === 0) return;
    setSavingEdit(true);
    try {
      // Update group name
      const { error: nameErr } = await supabase
        .from("broadcast_groups")
        .update({ name: editGroupName.trim() })
        .eq("id", editingGroupId);
      if (nameErr) throw nameErr;

      // Delete all old members and re-insert
      const { error: delErr } = await supabase
        .from("broadcast_group_members")
        .delete()
        .eq("group_id", editingGroupId);
      if (delErr) throw delErr;

      const members = editEmails.map((email) => ({
        group_id: editingGroupId,
        email,
        name: null,
      }));
      const { error: insErr } = await supabase.from("broadcast_group_members").insert(members);
      if (insErr) throw insErr;

      toast.success(`Grupo "${editGroupName.trim()}" atualizado!`);
      cancelEditGroup();
      loadGroups();
    } catch (err: any) {
      toast.error("Erro ao atualizar grupo: " + (err.message || ""));
    } finally {
      setSavingEdit(false);
    }
  };

  // Send all invites
  const handleSendAll = async () => {
    if (!user || emails.length === 0) return;
    setSending(true);
    const results: { email: string; link: string }[] = [];
    try {
      for (const email of emails) {
        const { data, error } = await supabase
          .from("sync_invites")
          .insert({ master_id: user.id, guest_email: email, setlist_id: setlistId, status: "pending" })
          .select("token")
          .single();
        if (error) { toast.error(`Erro ao convidar ${email}: ${error.message}`); continue; }
        results.push({ email, link: `${window.location.origin}/setlists/${setlistId}?invite=${data.token}` });
      }
      setInviteLinks(results);
      toast.success(`${results.length} convite(s) enviado(s)!`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (link: string, email: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(email);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAllLinks = async () => {
    const text = inviteLinks.map((l) => `${l.email}: ${l.link}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied("all");
    toast.success("Todos os links copiados!");
    setTimeout(() => setCopied(null), 2000);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Convidar Músicos
          </DialogTitle>
          <DialogDescription>
            Envie convites para sincronizar o repertório{" "}
            <strong>"{setlistName}"</strong> em tempo real.
          </DialogDescription>
        </DialogHeader>

        {/* ---- GROUP EDIT MODE ---- */}
        {editingGroupId && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Pencil className="h-3.5 w-3.5 text-primary" />
                Editar grupo
              </Label>
              <Button variant="ghost" size="sm" className="text-xs" onClick={cancelEditGroup}>
                Cancelar
              </Button>
            </div>

            <Input
              placeholder="Nome do grupo"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className="h-8 text-sm"
            />

            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Adicionar e-mail ao grupo"
                value={editEmailInput}
                onChange={(e) => setEditEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditEmail(); } }}
                className="flex-1 h-8 text-xs"
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={addEditEmail} disabled={!editEmailInput.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {editEmails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs">
                  {email}
                  <button onClick={() => removeEditEmail(email)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {editEmails.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum membro. Adicione pelo menos um e-mail.</p>
              )}
            </div>

            <Button
              size="sm"
              onClick={saveEditGroup}
              disabled={savingEdit || !editGroupName.trim() || editEmails.length === 0}
              className="w-full gap-1 text-xs"
            >
              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar alterações
            </Button>
          </div>
        )}

        {/* ---- NORMAL MODE ---- */}
        {!editingGroupId && (
          <div className="space-y-4">
            {/* Saved groups */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Grupos salvos
                </Label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-0.5">
                      <Button
                        variant={selectedGroupId === g.id ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => loadGroup(g.id)}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {g.name} ({g.members.length})
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditGroup(g)} title="Editar grupo">
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteGroup(g.id)} title="Excluir grupo">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email input */}
            <div className="space-y-2">
              <Label htmlFor="guest-email">Adicionar e-mails</Label>
              <div className="flex gap-2">
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="musico@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={addEmail} disabled={!emailInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Email chips */}
            {emails.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {emails.length} músico(s) selecionado(s)
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {emails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs">
                      {email}
                      <button onClick={() => removeEmail(email)} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                {/* Save as group */}
                {!showSaveGroup ? (
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowSaveGroup(true)}>
                    <Save className="h-3 w-3" />
                    Salvar como grupo
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Nome do grupo (ex: Banda Principal)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveAsGroup()}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button size="sm" onClick={saveAsGroup} disabled={savingGroup || !newGroupName.trim()} className="text-xs">
                      {savingGroup ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowSaveGroup(false)} className="text-xs">
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            {emails.length > 0 && inviteLinks.length === 0 && (
              <Button onClick={handleSendAll} disabled={sending} className="w-full gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar {emails.length} convite(s)
              </Button>
            )}

            {/* Generated links */}
            {inviteLinks.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Links gerados ({inviteLinks.length})</Label>
                  <Button variant="outline" size="sm" onClick={copyAllLinks} className="text-xs gap-1">
                    {copied === "all" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    Copiar todos
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {inviteLinks.map((inv) => (
                    <div key={inv.email} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground truncate min-w-0 flex-1">{inv.email}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(inv.link, inv.email)}>
                        {copied === inv.email ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Envie os links aos músicos. Quem já tem conta acessará o repertório direto. Quem não tem será direcionado ao cadastro.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
