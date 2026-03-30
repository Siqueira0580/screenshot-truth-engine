import { useState, useCallback } from "react";

const BOLD_KEY = "@smartcifra:isBold";
const ITALIC_KEY = "@smartcifra:isItalic";

export function useTypographyPrefs() {
  const [isBold, setIsBold] = useState(() => localStorage.getItem(BOLD_KEY) === "true");
  const [isItalic, setIsItalic] = useState(() => localStorage.getItem(ITALIC_KEY) === "true");

  const toggleBold = useCallback(() => {
    setIsBold((prev) => {
      const next = !prev;
      localStorage.setItem(BOLD_KEY, String(next));
      return next;
    });
  }, []);

  const toggleItalic = useCallback(() => {
    setIsItalic((prev) => {
      const next = !prev;
      localStorage.setItem(ITALIC_KEY, String(next));
      return next;
    });
  }, []);

  const typographyClasses = `${isBold ? "font-bold" : "font-normal"} ${isItalic ? "italic" : "not-italic"}`;

  return { isBold, isItalic, toggleBold, toggleItalic, typographyClasses };
}
