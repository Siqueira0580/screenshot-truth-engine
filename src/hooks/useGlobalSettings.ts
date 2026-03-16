import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const toSafeBoolean = (value: string | boolean | null | undefined) =>
  String(value).toLowerCase() === "true";

type GlobalSettingRow = {
  setting_key: string;
  setting_value: string | boolean | null;
};

export function useGlobalSettings() {
  const { user, loading: authLoading } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [vipMaintenanceMode, setVipMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const applySafeDefaults = () => {
      setMaintenanceMode(true);
      setVipMaintenanceMode(true);
      setLoading(false);
    };

    const loadSettings = async () => {
      setLoading(true);

      const [mRes, vRes] = await Promise.all([
        supabase.from("global_settings").select("setting_value").eq("setting_key", "maintenance_mode").maybeSingle(),
        supabase.from("global_settings").select("setting_value").eq("setting_key", "vip_maintenance_mode").maybeSingle(),
      ]);

      if (!isActive) return;

      if (mRes.error || vRes.error) {
        applySafeDefaults();
        return;
      }

      setMaintenanceMode(toSafeBoolean(mRes.data?.setting_value as string | boolean | null | undefined));
      setVipMaintenanceMode(toSafeBoolean(vRes.data?.setting_value as string | boolean | null | undefined));
      setLoading(false);
    };

    if (authLoading) {
      setLoading(true);
      return () => {
        isActive = false;
      };
    }

    if (!user) {
      setMaintenanceMode(false);
      setVipMaintenanceMode(false);
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    loadSettings();

    const channel = supabase
      .channel(`global_settings_changes:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_settings" },
        (payload) => {
          const row = payload.new as GlobalSettingRow | undefined;
          if (!row) return;

          if (row.setting_key === "maintenance_mode") {
            setMaintenanceMode(toSafeBoolean(row.setting_value));
          }

          if (row.setting_key === "vip_maintenance_mode") {
            setVipMaintenanceMode(toSafeBoolean(row.setting_value));
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  return { maintenanceMode, vipMaintenanceMode, loading };
}
