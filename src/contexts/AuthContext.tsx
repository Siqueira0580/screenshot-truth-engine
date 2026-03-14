import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_plan: string;
  pro_expires_at: string | null;
  terms_accepted: boolean;
  wizard_completed: boolean;
  library_setup_completed: boolean;
  started_with_empty_studio: boolean;
  preferred_instrument: string;
  favorite_styles: string[] | null;
  favorite_artists: any | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data as unknown as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const p = await fetchProfile(userId);
    setProfile(p);
    return p;
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = session?.user;
    if (currentUser) {
      await loadProfile(currentUser.id);
    }
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;

    // 1. Set up listener FIRST (per Supabase best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);

        if (newSession?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase internals
          setTimeout(async () => {
            if (!mounted) return;
            await loadProfile(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // 2. Then get initial session + profile synchronously
    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(initialSession);

      if (initialSession?.user) {
        await loadProfile(initialSession.user.id);
      }

      // GOLDEN RULE: only set loading=false AFTER profile is fetched
      if (mounted) setLoading(false);
    };

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
