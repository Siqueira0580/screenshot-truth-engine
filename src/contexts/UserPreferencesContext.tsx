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

interface UserPreferencesProfile {
  id: string;
  preferredInstrument: Instrument;
  wizardCompleted: boolean;
  librarySetupCompleted: boolean;
  favoriteStyles: string[];
  favoriteArtists: ArtistPref[];
  hasSeenWizard: boolean;
}

interface UserPreferences {
  profile: UserPreferencesProfile | null;
  preferredInstrument: Instrument;
  setPreferredInstrument: (instrument: Instrument) => Promise<void>;
  wizardCompleted: boolean;
  librarySetupCompleted: boolean;
  favoriteStyles: string[];
  favoriteArtists: ArtistPref[];
  saveWizardPreferences: (styles: string[], artists: ArtistPref[], skipped?: boolean) => Promise<void>;
  markLibrarySetupDone: () => void;
  hasSeenWizard: boolean;
  markWizardSeen: () => Promise<void>;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferences>({
  profile: null,
  preferredInstrument: "guitar",
  setPreferredInstrument: async () => {},
  wizardCompleted: false,
  librarySetupCompleted: false,
  favoriteStyles: [],
  favoriteArtists: [],
  saveWizardPreferences: async () => {},
  markLibrarySetupDone: () => {},
  hasSeenWizard: true,
  markWizardSeen: async () => {},
  loading: true,
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserPreferencesProfile | null>(null);
  const [preferredInstrument, setInstrumentState] = useState<Instrument>("guitar");
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [librarySetupCompleted, setLibrarySetupCompleted] = useState(false);
  const [favoriteStyles, setFavoriteStyles] = useState<string[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<ArtistPref[]>([]);
  const [hasSeenWizard, setHasSeenWizard] = useState(true);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const activeProfile = user && profile?.id === user.id ? profile : null;
  const loading = authLoading || isFetchingProfile || (!!user && !activeProfile);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      const stored = localStorage.getItem("preferred_instrument") as Instrument | null;
      setProfile(null);
      setInstrumentState(stored || "guitar");
      setWizardCompleted(false);
      setLibrarySetupCompleted(false);
      setFavoriteStyles([]);
      setFavoriteArtists([]);
      setHasSeenWizard(true);
      setIsFetchingProfile(false);
      return;
    }

    if (profile?.id === user.id) {
      setIsFetchingProfile(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setIsFetchingProfile(true);

      try {
        const { data } = await supabase
          .from("profiles")
          .select("preferred_instrument, wizard_completed, library_setup_completed, favorite_styles, favorite_artists, has_seen_wizard")
          .eq("id", user.id)
          .single();

        if (cancelled || !data) return;

        const nextPreferredInstrument = (data.preferred_instrument as Instrument) || "guitar";
        const nextFavoriteStyles = ((data as any).favorite_styles as string[]) || [];
        const artists = (data as any).favorite_artists;
        const nextFavoriteArtists = Array.isArray(artists) ? artists : [];
        const nextHasSeenWizard = !!(data as any).has_seen_wizard;
        const nextProfile: UserPreferencesProfile = {
          id: user.id,
          preferredInstrument: nextPreferredInstrument,
          wizardCompleted: !!(data as any).wizard_completed,
          librarySetupCompleted: !!(data as any).library_setup_completed,
          favoriteStyles: nextFavoriteStyles,
          favoriteArtists: nextFavoriteArtists,
          hasSeenWizard: nextHasSeenWizard,
        };

        setProfile(nextProfile);
        setInstrumentState(nextProfile.preferredInstrument);
        setWizardCompleted(nextProfile.wizardCompleted);
        setLibrarySetupCompleted(nextProfile.librarySetupCompleted);
        setFavoriteStyles(nextProfile.favoriteStyles);
        setFavoriteArtists(nextProfile.favoriteArtists);
        setHasSeenWizard(nextHasSeenWizard);
      } finally {
        if (!cancelled) {
          setIsFetchingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, profile?.id]);

  const setPreferredInstrument = useCallback(
    async (instrument: Instrument) => {
      setInstrumentState(instrument);
      setProfile((prev) => (prev ? { ...prev, preferredInstrument: instrument } : prev));
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
      const nextStyles = skipped ? [] : styles;
      const nextArtists = skipped ? [] : artists;

      setWizardCompleted(true);
      setFavoriteStyles(nextStyles);
      setFavoriteArtists(nextArtists);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              wizardCompleted: true,
              favoriteStyles: nextStyles,
              favoriteArtists: nextArtists,
            }
          : prev
      );

      localStorage.setItem(
        "smartcifra_preferences",
        JSON.stringify({ styles: nextStyles, artists: nextArtists, skipped })
      );

      if (user) {
        await supabase
          .from("profiles")
          .update({
            wizard_completed: true,
            favorite_styles: nextStyles,
            favorite_artists: nextArtists,
          } as any)
          .eq("id", user.id);
      }
    },
    [user]
  );

  const markLibrarySetupDone = useCallback(() => {
    setLibrarySetupCompleted(true);
    setProfile((prev) => (prev ? { ...prev, librarySetupCompleted: true } : prev));
  }, []);

  const markWizardSeen = useCallback(async () => {
    setHasSeenWizard(true);
    setProfile((prev) => (prev ? { ...prev, hasSeenWizard: true } : prev));
    if (user) {
      await supabase
        .from("profiles")
        .update({ has_seen_wizard: true } as any)
        .eq("id", user.id);
    }
  }, [user]);

  return (
    <UserPreferencesContext.Provider
      value={{
        profile: activeProfile,
        preferredInstrument,
        setPreferredInstrument,
        wizardCompleted,
        librarySetupCompleted,
        favoriteStyles,
        favoriteArtists,
        saveWizardPreferences,
        markLibrarySetupDone,
        hasSeenWizard,
        markWizardSeen,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}
