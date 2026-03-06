import { useState, useMemo } from "react";
import { Music } from "lucide-react";
import { extractUniqueChords } from "@/lib/chord-parser";
import SongChordsDrawer from "@/components/SongChordsDrawer";

interface SongChordsFABProps {
  /** The song body text (lyrics + chords) */
  bodyText: string | null | undefined;
  /** Extra CSS class for positioning adjustments */
  className?: string;
}

/**
 * Floating Action Button + Drawer that extracts and displays
 * all unique chords from a song text. Drop this into any page
 * that shows lyrics/chords.
 */
export default function SongChordsFAB({ bodyText, className }: SongChordsFABProps) {
  const [open, setOpen] = useState(false);

  const uniqueChords = useMemo(
    () => (bodyText ? extractUniqueChords(bodyText) : []),
    [bodyText],
  );

  if (!bodyText || uniqueChords.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed z-[90] bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95 ${className ?? ""}`}
        aria-label="Dicionário de acordes"
        title="Dicionário de acordes"
      >
        <Music className="h-6 w-6" />
      </button>

      <SongChordsDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        chords={uniqueChords}
      />
    </>
  );
}
