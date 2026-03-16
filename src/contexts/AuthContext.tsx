import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

/** Sync Google OAuth metadata to profiles table */
async function syncProfileFromOAuth(user: User) {
  const meta = user.user_metadata;
  if (!meta) return;

  const firstName = meta.first_name || meta.given_name || meta.full_name?.split(" ")[0] || meta.name?.split(" ")[0];
  const lastName = meta.last_name || meta.family_name || (meta.full_name?.split(" ").slice(1).join(" ")) || (meta.name?.split(" ").slice(1).join(" "));
  const avatarUrl = meta.avatar_url || meta.picture;

  if (!firstName && !avatarUrl) return;

  const updates: Record<string, string | null> = {};
  if (firstName) updates.first_name = firstName;
  if (lastName) updates.last_name = lastName;
  if (avatarUrl) updates.avatar_url = avatarUrl;

  await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        // Sync OAuth metadata on sign-in
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
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
