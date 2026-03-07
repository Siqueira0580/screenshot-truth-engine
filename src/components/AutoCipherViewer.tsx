import { useState, useMemo } from "react";
import { Edit3, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChordProParser } from "@/hooks/useChordProParser";
import { extractChordsFromChordPro } from "@/lib/chordpro-parser";
import ChordHighlight from "@/components/ChordHighlight";
import SongChordsDrawer from "@/components/SongChordsDrawer";
import { Music } from "lucide-react";

interface AutoCipherViewerProps {
  /** ChordPro formatted text, e.g. "[C]Letra da [Am]música" */
  chordProText: string;
  /** Called when user saves edits in raw mode */
  onSave?: (updatedText: string) => void;
  className?: string;
}

/**
 * Renders a ChordPro string with chords stacked above their syllables.
 * Includes an edit mode to modify raw ChordPro text and a FAB to open
 * the chord dictionary drawer.
 */
export default function AutoCipherViewer({
  chordProText,
  onSave,
  className,
}: AutoCipherViewerProps) {
  const [editMode, setEditMode] = useState(false);
  const [rawText, setRawText] = useState(chordProText);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Use the live text (raw edits) or the prop
  const displayText = editMode ? rawText : chordProText;
  const { lines, uniqueChords } = useChordProParser(displayText);

  // Keep rawText in sync when prop changes externally
  useState(() => {
    setRawText(chordProText);
  });

  const handleSave = () => {
    onSave?.(rawText);
    setEditMode(false);
  };

  if (!chordProText) return null;

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        {editMode ? (
          <>
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRawText(chordProText);
                setEditMode(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRawText(chordProText);
                setEditMode(true);
              }}
              className="gap-1.5"
            >
              <Edit3 className="h-4 w-4" />
              Editar cifra
            </Button>
            {uniqueChords.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDrawerOpen(true)}
                className="gap-1.5"
              >
                <Music className="h-4 w-4" />
                Acordes ({uniqueChords.length})
              </Button>
            )}
          </>
        )}
      </div>

      {/* Content */}
      {editMode ? (
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="w-full min-h-[300px] rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          spellCheck={false}
        />
      ) : (
        <div className="font-mono text-lg leading-relaxed whitespace-pre-wrap">
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} className="flex flex-wrap items-end mb-1">
              {line.tokens.map((token, tokenIdx) => (
                <span key={tokenIdx} className="inline-flex flex-col mr-0.5">
                  {/* Chord row */}
                  <span className="text-primary font-bold text-sm h-5 leading-5 select-none">
                    {token.chord ? (
                      <ChordHighlight chord={token.chord} />
                    ) : (
                      "\u00A0"
                    )}
                  </span>
                  {/* Lyric row */}
                  <span className="text-foreground whitespace-pre">
                    {token.lyric || "\u00A0"}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Chord Drawer */}
      <SongChordsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        chords={uniqueChords}
      />
    </div>
  );
}

