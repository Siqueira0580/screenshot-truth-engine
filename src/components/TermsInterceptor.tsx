import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import smartCifraLogo from "@/assets/smart-cifra-logo.webp";

interface TermsInterceptorProps {
  children: React.ReactNode;
}

export default function TermsInterceptor({ children }: TermsInterceptorProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("terms_accepted")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setTermsAccepted(data?.terms_accepted ?? false);
        setLoading(false);
      });
  }, [user]);

  // Admin bypass — never block admins
  if (isAdmin && !roleLoading) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (termsAccepted === false) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6 text-center">
          <img src={smartCifraLogo} alt="Smart Cifra" className="h-16 w-16 rounded-xl mx-auto" />

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-bold">Termos de Uso</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bem-vindo! Para continuar a usar a plataforma, você precisa aceitar os nossos{" "}
              <Link to="/terms" target="_blank" className="text-primary underline font-medium">
                Termos de Uso e Política de Privacidade
              </Link>.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                const { error } = await supabase
                  .from("profiles")
                  .update({ terms_accepted: true } as any)
                  .eq("id", user!.id);

                if (error) {
                  toast.error("Erro ao aceitar os termos. Tente novamente.");
                  setAccepting(false);
                  return;
                }

                setTermsAccepted(true);
                toast.success("Termos aceites com sucesso!");
              }}
            >
              {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Li e Aceito
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={async () => {
                await signOut();
                toast.info("Você precisa aceitar os termos para utilizar a plataforma.");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Recusar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
