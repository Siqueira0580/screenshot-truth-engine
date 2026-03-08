import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearUserLibrary } from "@/lib/supabase-queries";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DangerZone() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (confirmText !== "RESETAR" || !user) return;
    setLoading(true);
    try {
      await clearUserLibrary();
      await supabase
        .from("profiles")
        .update({
          wizard_completed: false,
          library_setup_completed: false,
          favorite_styles: [],
          favorite_artists: [],
        } as any)
        .eq("id", user.id);

      toast.success("Perfil resetado com sucesso!");
      setResetOpen(false);
      setConfirmText("");
      // Force full reload to trigger onboarding again
      navigate("/songs");
    } catch (err: any) {
      toast.error("Erro ao resetar: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "EXCLUIR" || !user) return;
    setLoading(true);
    try {
      // Clear user data
      await clearUserLibrary();
      await supabase.from("profiles").delete().eq("id", user.id);

      // Sign out
      await supabase.auth.signOut();
      toast.success("Conta excluída com sucesso. Sentiremos sua falta!");
      navigate("/");
    } catch (err: any) {
      toast.error("Erro ao excluir conta: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5 space-y-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-bold text-lg">Zona de Perigo</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Ações irreversíveis. Prossiga com cuidado.
      </p>

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => { setConfirmText(""); setResetOpen(true); }}
        >
          <RotateCcw className="h-4 w-4" />
          Resetar Meu Perfil
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => { setConfirmText(""); setDeleteOpen(true); }}
        >
          <Trash2 className="h-4 w-4" />
          Excluir Minha Conta
        </Button>
      </div>

      {/* Reset Modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Resetar Perfil
            </DialogTitle>
            <DialogDescription>
              Isto irá remover todas as músicas da sua biblioteca pessoal e limpar suas preferências.
              Você será redirecionado para configurar tudo novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium text-foreground">
              Digite <span className="font-mono font-bold text-destructive">RESETAR</span> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESETAR"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "RESETAR" || loading}
              onClick={handleReset}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir Conta Permanentemente
            </DialogTitle>
            <DialogDescription>
              <strong className="text-destructive">Esta ação é irreversível!</strong> Todos os seus dados, biblioteca e preferências serão apagados.
              Você precisará se recadastrar para usar a plataforma novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium text-foreground">
              Digite <span className="font-mono font-bold text-destructive">EXCLUIR</span> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "EXCLUIR" || loading}
              onClick={handleDeleteAccount}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir Minha Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
