import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import MaintenancePage from "@/pages/MaintenancePage";
import { Loader2 } from "lucide-react";

const PUBLIC_WHITELIST = ["/login", "/register", "/forgot-password", "/reset-password", "/terms", "/"];

export default function MaintenanceInterceptor({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { maintenanceMode, loading: settingsLoading } = useGlobalSettings();
  const location = useLocation();

  const isLoading = roleLoading || settingsLoading;

  // Step 1: Wait for data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step 2: Whitelist public routes (login, register, etc.)
  const isWhitelisted = PUBLIC_WHITELIST.some((r) =>
    r === "/" ? location.pathname === "/" : location.pathname.startsWith(r)
  );
  if (isWhitelisted) return <>{children}</>;

  // Step 3: Admin bypass — absolute
  if (isAdmin) return <>{children}</>;

  // Step 4: Global maintenance block
  if (maintenanceMode) return <MaintenancePage />;

  // Step 5: Normal flow
  return <>{children}</>;
}
