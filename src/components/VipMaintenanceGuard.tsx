import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import MaintenancePage from "@/pages/MaintenancePage";

const VIP_ROUTES = ["/studio", "/compositions", "/compose", "/study"];

const isMaintenanceEnabled = (value: string | boolean | null | undefined) =>
  String(value).toLowerCase() === "true";

export default function VipMaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { vipMaintenanceMode, loading: settingsLoading } = useGlobalSettings();
  const location = useLocation();

  const isVipRoute = VIP_ROUTES.some((route) => location.pathname.startsWith(route));
  const isLoading = authLoading || settingsLoading || (user ? roleLoading : false);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isVipRoute) return <>{children}</>;
  if (isAdmin) return <>{children}</>;

  const isMaintenanceActive = isMaintenanceEnabled(vipMaintenanceMode);

  if (isMaintenanceActive) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}
