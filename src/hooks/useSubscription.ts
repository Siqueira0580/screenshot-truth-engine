import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Plan = "free" | "pro";

export function useSubscription() {
  const { user } = useAuth();
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

  const isFree = plan === "free";
  const isPro = plan === "pro";

  return { plan, isFree, isPro, loading };
}
