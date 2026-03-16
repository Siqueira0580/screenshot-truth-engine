import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Instrument } from "@/lib/chord-diagrams";

interface ArtistPref {
  id: string;
  name: string;
  genre: string[];
  imageUrl: string | null;
}

interface UserPreferences {
  preferredInstrument: Instrument;
  setPreferredInstrument: (instrument: Instrument) => Promise<void>;
  wizardCompleted: boolean;
  librarySetupCompleted: boolean;
  favoriteStyles: string[];
  favoriteArtists: ArtistPref[];
  saveWizardPreferences: (styles: string[], artists: ArtistPref[], skipped?: boolean) => Promise<void>;
  markLibrarySetupDone: () => void;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferences>({
  preferredInstrument: "guitar",
  setPreferredInstrument: async () => {},
  wizardCompleted: false,
  librarySetupCompleted: false,
  favoriteStyles: [],
  favoriteArtists: [],
  saveWizardPreferences: async () => {},
  markLibrarySetupDone: () => {},
  loading: true,
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferredInstrument, setInstrumentState] = useState<Instrument>("guitar");
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [librarySetupCompleted, setLibrarySetupCompleted] = useState(false);
  const [favoriteStyles, setFavoriteStyles] = useState<string[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<ArtistPref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem("preferred_instrument") as Instrument | null;
      if (stored) setInstrumentState(stored);
      setLoading(false);
      return;
    }

    // CRITICAL: Reset loading to true before fetching to prevent FOUC
    // Without this, navigating or transitioning from null→user leaves loading=false
    // while wizardCompleted is still false, causing the onboarding wizard to flash.
    setLoading(true);

    supabase
      .from("profiles")
      .select("preferred_instrument, wizard_completed, library_setup_completed, favorite_styles, favorite_artists")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.preferred_instrument) setInstrumentState(data.preferred_instrument as Instrument);
          setWizardCompleted(!!(data as any).wizard_completed);
          setLibrarySetupCompleted(!!(data as any).library_setup_completed);
          setFavoriteStyles(((data as any).favorite_styles as string[]) || []);
          const artists = (data as any).favorite_artists;
          setFavoriteArtists(Array.isArray(artists) ? artists : []);
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

  const saveWizardPreferences = useCallback(
    async (styles: string[], artists: ArtistPref[], skipped = false) => {
      setWizardCompleted(true);
      setFavoriteStyles(skipped ? [] : styles);
      setFavoriteArtists(skipped ? [] : artists);

      localStorage.setItem(
        "smartcifra_preferences",
        JSON.stringify({ styles: skipped ? [] : styles, artists: skipped ? [] : artists, skipped })
      );

      if (user) {
        await supabase
          .from("profiles")
          .update({
            wizard_completed: true,
            favorite_styles: skipped ? [] : styles,
            favorite_artists: skipped ? [] : artists,
          } as any)
          .eq("id", user.id);
      }
    },
    [user]
  );

  const markLibrarySetupDone = useCallback(() => {
    setLibrarySetupCompleted(true);
  }, []);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferredInstrument,
        setPreferredInstrument,
        wizardCompleted,
        librarySetupCompleted,
        favoriteStyles,
        favoriteArtists,
        saveWizardPreferences,
        markLibrarySetupDone,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}
