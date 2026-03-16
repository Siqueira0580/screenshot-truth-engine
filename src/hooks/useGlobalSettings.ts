import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useGlobalSettings() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [vipMaintenanceMode, setVipMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("global_settings").select("setting_value").eq("setting_key", "maintenance_mode").maybeSingle(),
      supabase.from("global_settings").select("setting_value").eq("setting_key", "vip_maintenance_mode").maybeSingle(),
    ]).then(([mRes, vRes]) => {
      setMaintenanceMode(String(mRes.data?.setting_value).toLowerCase() === "true");
      setVipMaintenanceMode(String(vRes.data?.setting_value).toLowerCase() === "true");
      setLoading(false);
    });

    const channel = supabase
      .channel("global_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_settings" },
        (payload) => {
          const row = payload.new as { setting_key: string; setting_value: string | null } | undefined;
          if (row?.setting_key === "maintenance_mode") {
            setMaintenanceMode(String(row.setting_value).toLowerCase() === "true");
          }
          if (row?.setting_key === "vip_maintenance_mode") {
            setVipMaintenanceMode(String(row.setting_value).toLowerCase() === "true");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { maintenanceMode, vipMaintenanceMode, loading };
}
