import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const toastShown = useRef(false);

  const loading = authLoading || roleLoading;

  useEffect(() => {
    if (!loading && user && !isAdmin && !toastShown.current) {
      toastShown.current = true;
      toast.error("Acesso negado.");
    }
  }, [loading, user, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/songs" replace />;

  return <>{children}</>;
}
