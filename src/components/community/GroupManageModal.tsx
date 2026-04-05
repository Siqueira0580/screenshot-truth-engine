import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { UserPlus, Trash2, Mail, LogOut, Link2, Loader2, MoreHorizontal, ShieldBan, ShieldCheck, Ban, Crown, ShieldOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  isCreator: boolean;
  onLeave?: () => void;
}

export default function GroupManageModal({ open, onOpenChange, groupId, groupName, isCreator, onLeave }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  // Check if current user is group admin
  const { data: currentMember } = useQuery({
    queryKey: ["group-my-membership", groupId],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_group_members")
        .select("id, role, status")
        .eq("group_id", groupId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isAdmin = isCreator || currentMember?.role === "admin";

  const generateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase
        .from("group_invites")
        .insert({ group_id: groupId, created_by: user!.id } as any)
        .select("id")
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/invite/${data.id}`;
      setInviteLink(url);
    } catch {
      toast.error("Erro ao gerar link de convite");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copiado!");
  };

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_group_members")
        .select("id, user_id, role, status, created_at")
        .eq("group_id", groupId);
      if (error) throw error;

      const userIds = (data || []).map((m: any) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .in("id", userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      return (data || []).map((m: any) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      }));
    },
  });

  const activeMembers = members.filter((m: any) => m.status !== "blocked" && m.user_id !== user?.id);
  const blockedMembers = members.filter((m: any) => m.status === "blocked");

  const inviteMutation = useMutation({
    mutationFn: async (inviteEmail: string) => {
      const { data: userToAdd, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail)
        .single();

      if (findError || !userToAdd) throw new Error("NOT_FOUND");
      if (userToAdd.id === user!.id) throw new Error("SELF");

      const { data: existing } = await supabase
        .from("community_group_members")
        .select("id, status")
        .eq("group_id", groupId)
        .eq("user_id", userToAdd.id)
        .maybeSingle();

      if (existing && existing.status === "active") throw new Error("ALREADY_MEMBER");

      // If blocked, reactivate
      if (existing && existing.status === "blocked") {
        const { error } = await supabase
          .from("community_group_members")
          .update({ status: "active" } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_group_members")
          .insert({ group_id: groupId, user_id: userToAdd.id, role: "member", status: "active" } as any);
        if (error) throw error;
      }

      await supabase.from("notifications").insert({
        user_id: userToAdd.id,
        type: "group_invite",
        title: `Você foi adicionado ao grupo "${groupName}"`,
        body: "Acesse a aba Meus Grupos na Comunidade para ver as publicações.",
        metadata: { group_id: groupId },
      } as any);
    },
    onSuccess: () => {
      setEmail("");
      toast.success("Membro adicionado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (err: Error) => {
      if (err.message === "NOT_FOUND") toast.error("Utilizador não encontrado com esse e-mail.");
      else if (err.message === "SELF") toast.error("Você já é membro do grupo.");
      else if (err.message === "ALREADY_MEMBER") toast.error("Este utilizador já é membro do grupo.");
      else toast.error("Erro ao adicionar membro.");
    },
  });

  const kickMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("community_group_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmKick(null);
      toast.success("Membro removido");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao remover membro"),
  });

  const banMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("community_group_members")
        .update({ status: "blocked" } as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro bloqueado");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao bloquear membro"),
  });

  const unbanMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("community_group_members")
        .update({ status: "active" } as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro desbloqueado");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao desbloquear membro"),
  });

  const promoteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("community_group_members")
        .update({ role: "admin" } as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro promovido a Admin!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao promover membro"),
  });

  const demoteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("community_group_members")
        .update({ role: "member" } as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissão de Admin removida");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao rebaixar membro"),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("community_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Você saiu do grupo");
      queryClient.invalidateQueries({ queryKey: ["my-community-groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      onOpenChange(false);
      onLeave?.();
    },
    onError: () => toast.error("Erro ao sair do grupo"),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("community_group_members").delete().eq("group_id", groupId);
      await supabase.from("community_posts").delete().eq("group_id", groupId);
      const { error } = await supabase.from("community_groups").delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["my-community-groups"] });
      onOpenChange(false);
      onLeave?.();
    },
    onError: () => toast.error("Erro ao excluir grupo"),
  });

  const getInitials = (p: any) => {
    if (!p) return "?";
    return [p.first_name, p.last_name].filter(Boolean).map((n: string) => n[0]?.toUpperCase()).join("") || "?";
  };

  const getName = (p: any) => {
    if (!p) return "Desconhecido";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Desconhecido";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{groupName}</DialogTitle>
          </DialogHeader>

          {isAdmin ? (
            <Tabs defaultValue="invites" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="invites">Convites</TabsTrigger>
                <TabsTrigger value="members">
                  Membros ({activeMembers.length + (user ? 1 : 0)})
                </TabsTrigger>
              </TabsList>

              {/* === TAB: CONVITES === */}
              <TabsContent value="invites" className="space-y-4 mt-4">
                {/* Invite by email */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" /> Convidar por E-mail
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="pl-9"
                        type="email"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!email.trim() || inviteMutation.isPending}
                      onClick={() => { if (email.trim()) inviteMutation.mutate(email.trim()); }}
                    >
                      {inviteMutation.isPending ? "..." : "Adicionar"}
                    </Button>
                  </div>
                </div>

                {/* Invite by link */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="h-4 w-4" /> Convidar por Link
                  </Label>
                  {!inviteLink ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      disabled={generatingLink}
                      onClick={generateInviteLink}
                    >
                      {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Gerar Link de Convite
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input value={inviteLink} readOnly className="text-xs" />
                        <Button variant="outline" size="sm" onClick={copyLink}>Copiar</Button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Fui convidado para entrar no nosso grupo de música! Clique aqui para aceitar: ${inviteLink}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            WhatsApp
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                          <a href={`mailto:?subject=${encodeURIComponent(`Convite para o Grupo Musical`)}&body=${encodeURIComponent(`Você foi convidado para entrar no grupo "${groupName}". Clique no link para aceitar ou recusar: ${inviteLink}`)}`}>
                            <Mail className="h-4 w-4" /> E-mail
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete group */}
                {isCreator && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-1.5 mt-4"
                    disabled={deleteGroupMutation.isPending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteGroupMutation.isPending ? "Excluindo..." : "Excluir grupo"}
                  </Button>
                )}
              </TabsContent>

              {/* === TAB: MEMBROS === */}
              <TabsContent value="members" className="space-y-4 mt-4">
                {/* Active members */}
                <div className="space-y-2">
                  <Label>Membros Ativos</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum membro além de você.</p>
                    )}
                    {activeMembers.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(m.profile)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getName(m.profile)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {m.role === "admin" ? (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <Crown className="h-3 w-3" /> Admin
                              </span>
                            ) : "Membro"} · {m.profile?.email}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {m.role !== "admin" ? (
                              <>
                                <DropdownMenuItem onClick={() => promoteMutation.mutate(m.id)} className="gap-2">
                                  <Crown className="h-3.5 w-3.5" /> Promover a Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConfirmKick(m.id)} className="gap-2">
                                  <Trash2 className="h-3.5 w-3.5" /> Remover
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => banMutation.mutate(m.id)} className="gap-2 text-destructive focus:text-destructive">
                                  <Ban className="h-3.5 w-3.5" /> Bloquear
                                </DropdownMenuItem>
                              </>
                            ) : isCreator ? (
                              <DropdownMenuItem onClick={() => demoteMutation.mutate(m.id)} className="gap-2">
                                <ShieldOff className="h-3.5 w-3.5" /> Remover Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                                <Crown className="h-3.5 w-3.5" /> Administrador
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blocked members */}
                {blockedMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-destructive">
                      <ShieldBan className="h-4 w-4" /> Membros Bloqueados ({blockedMembers.length})
                    </Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {blockedMembers.map((m: any) => (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                              {getInitials(m.profile)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getName(m.profile)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{m.profile?.email}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={unbanMutation.isPending}
                            onClick={() => unbanMutation.mutate(m.id)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Desbloquear
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            /* Non-admin view: just member list + leave */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Membros ({members.length})</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {members.filter((m: any) => m.status !== "blocked").map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(m.profile)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getName(m.profile)}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.role === "admin" ? "Admin" : "Membro"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5"
                disabled={leaveMutation.isPending}
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut className="h-4 w-4" />
                {leaveMutation.isPending ? "Saindo..." : "Sair do grupo"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm kick */}
      <AlertDialog open={!!confirmKick} onOpenChange={(o) => { if (!o) setConfirmKick(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O membro será removido do grupo. Ele poderá ser convidado novamente no futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmKick) kickMutation.mutate(confirmKick); }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm leave */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai sair do grupo <strong>{groupName}</strong>. Para voltar, será necessário um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => leaveMutation.mutate()}
            >
              Sair do grupo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete group */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              O grupo <strong>{groupName}</strong> será excluído permanentemente, incluindo todas as publicações e membros. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGroupMutation.mutate()}
            >
              Excluir grupo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
