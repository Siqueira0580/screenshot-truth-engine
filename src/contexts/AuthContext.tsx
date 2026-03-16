import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Ensure profile exists and sync OAuth metadata */
async function syncProfileFromOAuth(user: User) {
  const meta = user.user_metadata;
  
  const firstName = meta?.first_name || meta?.given_name || meta?.full_name?.split(" ")[0] || meta?.name?.split(" ")[0] || user.email?.split("@")[0];
  const lastName = meta?.last_name || meta?.family_name || (meta?.full_name?.split(" ").slice(1).join(" ")) || (meta?.name?.split(" ").slice(1).join(" ")) || null;
  const avatarUrl = meta?.avatar_url || meta?.picture || null;

  await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      first_name: firstName || null,
      last_name: lastName || null,
      avatar_url: avatarUrl,
    }, { onConflict: "id", ignoreDuplicates: false });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        // Handle OAuth intent verification & profile sync
        if (event === "SIGNED_IN" && session?.user) {
          const intent = localStorage.getItem('oauth_intent');
          localStorage.removeItem('oauth_intent');

          if (intent === 'login') {
            const createdAt = new Date(session.user.created_at).getTime();
            const now = Date.now();
            const isNewAccount = (now - createdAt) < 10000; // < 10 seconds

            if (isNewAccount) {
              // OAuth auto-created this account but user intended LOGIN only
              setTimeout(async () => {
                await supabase.auth.signOut();
                toast.error("Parece que ainda não tem registo no sistema! Por favor, utilize a opção de criar conta.", { duration: 5000 });
                window.location.href = '/register';
              }, 0);
              return;
            }
          }

          setTimeout(() => syncProfileFromOAuth(session.user), 0);
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          setTimeout(() => syncProfileFromOAuth(session.user), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
