import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { useAuth } from "@/contexts/AuthContext";
import MaintenancePage from "@/pages/MaintenancePage";
import { Loader2 } from "lucide-react";

export default function MaintenanceInterceptor({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { maintenanceMode, loading: settingsLoading } = useGlobalSettings();

  // 1. Aguardar carregamento inicial da sessão
  const isLoading = authLoading || settingsLoading || (user && roleLoading);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Visitantes não autenticados: acesso livre (precisam chegar ao login)
  if (!user) return <>{children}</>;

  // 3. Admin autenticado: bypass absoluto
  if (isAdmin) return <>{children}</>;

  // 4. Utilizador comum + manutenção ativa: bloqueio total
  if (maintenanceMode) return <MaintenancePage />;

  // 5. Fluxo normal
  return <>{children}</>;
}
