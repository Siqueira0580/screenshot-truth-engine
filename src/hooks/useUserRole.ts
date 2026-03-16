import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedIsAdmin, setResolvedIsAdmin] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (authLoading) {
      return () => {
        isActive = false;
      };
    }

    if (!user) {
      setResolvedUserId(null);
      setResolvedIsAdmin(false);
      return () => {
        isActive = false;
      };
    }

    const currentUserId = user.id;

    if (resolvedUserId === currentUserId) {
      return () => {
        isActive = false;
      };
    }

    const fetchRole = async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: currentUserId,
        _role: "admin",
      });

      if (!isActive) return;

      setResolvedIsAdmin(!error && data === true);
      setResolvedUserId(currentUserId);
    };

    fetchRole();

    return () => {
      isActive = false;
    };
  }, [user, authLoading, resolvedUserId]);

  const loading = authLoading || (!!user && resolvedUserId !== user.id);
  const isAdmin = !loading && !!user && resolvedIsAdmin;

  return { isAdmin, loading };
}
