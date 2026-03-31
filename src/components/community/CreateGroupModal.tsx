import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function CreateGroupModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (groupName: string) => {
      // Create the group
      const { data: group, error } = await supabase
        .from("community_groups")
        .insert({ name: groupName, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Auto-add creator as member
      await supabase.from("community_group_members").insert({
        group_id: group.id,
        user_id: user!.id,
      });

      return group;
    },
    onSuccess: () => {
      setOpen(false);
      setName("");
      toast.success("Grupo criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-community-groups"] });
    },
    onError: () => toast.error("Erro ao criar grupo"),
  });

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo Grupo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Novo Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do grupo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Banda do João"
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => { if (name.trim()) createMutation.mutate(name.trim()); }}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
