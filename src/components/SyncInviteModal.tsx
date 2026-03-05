import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SyncInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setlistId: string;
  setlistName: string;
}

export default function SyncInviteModal({ open, onOpenChange, setlistId, setlistName }: SyncInviteModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!user || !email.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("E-mail inválido");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("sync_invites")
        .insert({
          master_id: user.id,
          guest_email: email.trim().toLowerCase(),
          setlist_id: setlistId,
          status: "pending",
        })
        .select("token")
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/setlists/${setlistId}?invite=${data.token}`;
      setInviteLink(link);
      toast.success(`Convite criado para ${email.trim()}`);
      setEmail("");
    } catch (err: any) {
      toast.error("Erro ao criar convite: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Convidar Músico
          </DialogTitle>
          <DialogDescription>
            Envie um convite para sincronizar o repertório <strong>"{setlistName}"</strong> em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-email">E-mail do músico</Label>
            <div className="flex gap-2">
              <Input
                id="guest-email"
                type="email"
                placeholder="musico@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                className="flex-1"
              />
              <Button onClick={handleInvite} disabled={sending || !email.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
              </Button>
            </div>
          </div>

          {inviteLink && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs text-muted-foreground">Link de convite gerado:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-foreground break-all bg-background rounded p-2 border border-border">
                  {inviteLink}
                </code>
                <Button variant="outline" size="icon" onClick={copyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Envie este link ao músico. Se ele já tem conta, abrirá o repertório diretamente. Caso contrário, será direcionado para o cadastro.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
