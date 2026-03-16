import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { useAuth } from "@/contexts/AuthContext";
import MaintenancePage from "@/pages/MaintenancePage";
import { Loader2 } from "lucide-react";

export default function MaintenanceInterceptor({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { maintenanceMode, loading: settingsLoading } = useGlobalSettings();

  // 1. Trava de carregamento (garante que perfil/role/settings foram lidos)
  const isLoading = authLoading || settingsLoading || (user ? roleLoading : false);
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Visitantes não autenticados: acesso livre (precisam chegar ao login/registo)
  if (!user) return <>{children}</>;

  // 3. BYPASS ABSOLUTO PARA O ADMIN (chave mestra)
  if (isAdmin) return <>{children}</>;

  // 4. A BARREIRA DE MANUTENÇÃO — String-safe para boolean/string do Supabase
  const isMaintenanceActive = String(maintenanceMode).toLowerCase() === "true";
  if (isMaintenanceActive) {
    return <MaintenancePage />;
  }

  // 5. Caminho livre se não houver manutenção
  return <>{children}</>;
}
