import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useGlobalSettings() {
  const [vipMaintenanceMode, setVipMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("global_settings")
      .select("setting_value")
      .eq("setting_key", "vip_maintenance_mode")
      .maybeSingle()
      .then(({ data }) => {
        setVipMaintenanceMode(data?.setting_value === "true");
        setLoading(false);
      });

    // Realtime subscription for instant updates
    const channel = supabase
      .channel("global_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_settings",
        },
        (payload) => {
          const row = payload.new as { setting_key: string; setting_value: string | null } | undefined;
          if (row?.setting_key === "vip_maintenance_mode") {
            setVipMaintenanceMode(row.setting_value === "true");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { vipMaintenanceMode, loading };
}
