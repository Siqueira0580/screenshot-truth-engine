import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import MaintenancePage from "@/pages/MaintenancePage";
import { Loader2 } from "lucide-react";

export default function MaintenanceInterceptor({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("global_settings")
      .select("setting_value")
      .eq("setting_key", "maintenance_mode")
      .maybeSingle()
      .then(({ data }) => {
        setMaintenanceOn(data?.setting_value === "true");
        setLoading(false);
      });
  }, []);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (maintenanceOn && !isAdmin) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}
