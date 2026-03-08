import { useState } from "react";
import { UserPlus, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compositionId: string;
  currentEmails: string[];
  onUpdated: (emails: string[]) => void;
}

export default function InviteCollaboratorModal({ open, onOpenChange, compositionId, currentEmails, onUpdated }: Props) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Insira um e-mail válido.");
      return;
    }
    if (currentEmails.includes(trimmed)) {
      toast.error("Este e-mail já foi convidado.");
      return;
    }

    setSaving(true);
    try {
      const updated = [...currentEmails, trimmed];
      const { error } = await supabase
        .from("compositions")
        .update({ shared_with_emails: updated } as any)
        .eq("id", compositionId);
      if (error) throw error;
      onUpdated(updated);
      setEmail("");
      toast.success(`Convite enviado para ${trimmed}!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao convidar parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (emailToRemove: string) => {
    setSaving(true);
    try {
      const updated = currentEmails.filter((e) => e !== emailToRemove);
      const { error } = await supabase
        .from("compositions")
        .update({ shared_with_emails: updated } as any)
        .eq("id", compositionId);
      if (error) throw error;
      onUpdated(updated);
      toast.success("Colaborador removido.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover colaborador.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Convidar Parceiro
          </DialogTitle>
          <DialogDescription>
            Adicione o e-mail do seu parceiro de composição. Ele verá esta música no cofre criativo dele.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            type="email"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
          <Button onClick={handleInvite} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Convidar
          </Button>
        </div>

        {currentEmails.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Colaboradores</p>
            <div className="flex flex-wrap gap-2">
              {currentEmails.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1 pr-1">
                  {e}
                  <button
                    onClick={() => handleRemove(e)}
                    className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
