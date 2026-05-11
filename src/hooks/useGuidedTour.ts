import { useState, useCallback } from "react";

const TOUR_PREFIX = "smartcifra_tour_";
export const TOURS_DISABLED_KEY = "smartcifra_tours_disabled";

export function areToursDisabled() {
  return localStorage.getItem(TOURS_DISABLED_KEY) === "true";
}

export function setToursDisabled(disabled: boolean) {
  if (disabled) localStorage.setItem(TOURS_DISABLED_KEY, "true");
  else localStorage.removeItem(TOURS_DISABLED_KEY);
}

export function useGuidedTour(tourKey: string) {
  const storageKey = `${TOUR_PREFIX}${tourKey}`;
  
  const [run, setRun] = useState(() => {
    if (areToursDisabled()) return false;
    return localStorage.getItem(storageKey) !== "true";
  });

  const completeTour = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setRun(false);
  }, [storageKey]);

  const replayTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setRun(true);
  }, [storageKey]);

  return { run, completeTour, replayTour, setRun };
}
