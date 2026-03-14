import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";

export default function GlobalBanner() {
  const [banner, setBanner] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase
      .from("global_settings")
      .select("setting_value")
      .eq("setting_key", "maintenance_banner")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.setting_value) setBanner(data.setting_value);
      });
  }, []);

  if (!banner || dismissed) return null;

  return (
    <div className="relative bg-amber-500 text-amber-950 text-sm font-medium px-4 py-2 text-center flex items-center justify-center gap-2 z-[60]">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{banner}</span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
