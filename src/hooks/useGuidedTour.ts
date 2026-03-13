import { useState, useCallback } from "react";

const TOUR_PREFIX = "smartcifra_tour_";

export function useGuidedTour(tourKey: string) {
  const storageKey = `${TOUR_PREFIX}${tourKey}`;
  
  const [run, setRun] = useState(() => {
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
