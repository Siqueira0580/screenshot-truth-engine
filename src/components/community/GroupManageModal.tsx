import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { UserPlus, Trash2, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  isCreator: boolean;
}

export default function GroupManageModal({ open, onOpenChange, groupId, groupName, isCreator }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_group_members")
        .select("id, user_id, created_at")
        .eq("group_id", groupId);
      if (error) throw error;

      // Fetch profiles for members
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

  const inviteMutation = useMutation({
    mutationFn: async (inviteEmail: string) => {
      // Find user by email
      const { data: userToAdd, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail)
        .single();

      if (findError || !userToAdd) {
        throw new Error("NOT_FOUND");
      }

      if (userToAdd.id === user!.id) {
        throw new Error("SELF");
      }

      // Check if already member
      const { data: existing } = await supabase
        .from("community_group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userToAdd.id)
        .maybeSingle();

      if (existing) {
        throw new Error("ALREADY_MEMBER");
      }

      const { error } = await supabase
        .from("community_group_members")
        .insert({ group_id: groupId, user_id: userToAdd.id });
      if (error) throw error;
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

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("community_group_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: () => toast.error("Erro ao remover membro"),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{groupName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite form - only for creator */}
          {isCreator && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Convidar Membro
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
          )}

          {/* Members list */}
          <div className="space-y-2">
            <Label>Membros ({members.length})</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(m.profile)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getName(m.profile)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.profile?.email}</p>
                  </div>
                  {isCreator && m.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
