import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useUserRole } from "@/hooks/useUserRole";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: prefsLoading, hasSeenWizard, markWizardSeen } = useUserPreferences();
  const { loading: roleLoading } = useUserRole();

  const isLoading = authLoading || prefsLoading || (user ? roleLoading : false);

  if (isLoading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {children}
      {user && profile && !hasSeenWizard && (
        <OnboardingWizard open={true} onComplete={markWizardSeen} />
      )}
    </>
  );
}
