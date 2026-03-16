import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export type Plan = "free" | "pro";

export function useSubscription() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan("free");
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setPlan((data?.subscription_plan as Plan) ?? "free");
        setLoading(false);
      });
  }, [user]);

  // Admin always has VIP/PRO access
  const isPro = plan === "pro" || isAdmin;
  const isFree = !isPro;

  return { plan, isFree, isPro, loading };
}
