import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Instrument } from "@/lib/chord-diagrams";

interface UserPreferences {
  preferredInstrument: Instrument;
  setPreferredInstrument: (instrument: Instrument) => Promise<void>;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferences>({
  preferredInstrument: "guitar",
  setPreferredInstrument: async () => {},
  loading: true,
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferredInstrument, setInstrumentState] = useState<Instrument>("guitar");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Fallback to localStorage for non-logged users
      const stored = localStorage.getItem("preferred_instrument") as Instrument | null;
      if (stored) setInstrumentState(stored);
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("preferred_instrument")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.preferred_instrument) {
          setInstrumentState(data.preferred_instrument as Instrument);
        }
        setLoading(false);
      });
  }, [user]);

  const setPreferredInstrument = useCallback(
    async (instrument: Instrument) => {
      setInstrumentState(instrument);
      localStorage.setItem("preferred_instrument", instrument);

      if (user) {
        await supabase
          .from("profiles")
          .update({ preferred_instrument: instrument } as any)
          .eq("id", user.id);
      }
    },
    [user]
  );

  return (
    <UserPreferencesContext.Provider value={{ preferredInstrument, setPreferredInstrument, loading }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}
