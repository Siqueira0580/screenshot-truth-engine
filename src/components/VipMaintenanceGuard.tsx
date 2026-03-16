import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { toast } from "sonner";

const VIP_ROUTES = ["/studio", "/compositions", "/compose", "/study"];

export default function VipMaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useUserRole();
  const { vipMaintenanceMode } = useGlobalSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const redirected = useRef(false);

  const isVipRoute = VIP_ROUTES.some((r) => location.pathname.startsWith(r));

  useEffect(() => {
    if (vipMaintenanceMode && !isAdmin && isVipRoute && !redirected.current) {
      redirected.current = true;
      toast.info("O Estúdio está a receber melhorias e voltará em breve!");
      navigate("/songs", { replace: true });
    } else if (!isVipRoute) {
      redirected.current = false;
    }
  }, [vipMaintenanceMode, isAdmin, isVipRoute, navigate]);

  return <>{children}</>;
}
