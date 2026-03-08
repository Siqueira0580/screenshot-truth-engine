import { useChordProParser } from "@/hooks/useChordProParser";
import ChordHighlight from "@/components/ChordHighlight";

interface ChordProDisplayProps {
  text: string;
  className?: string;
}

/**
 * Renders ChordPro-formatted text with chords stacked above syllables.
 * Filters out metadata directives like {title:...}.
 */
export default function ChordProDisplay({ text, className }: ChordProDisplayProps) {
  const { lines } = useChordProParser(text);

  return (
    <div className={`${className} font-mono`}>
      {lines.map((line, lineIdx) => {
        // Filter out directive lines like {title:...}
        const firstToken = line.tokens[0];
        if (firstToken && !firstToken.chord && /^\s*\{[^}]+\}\s*$/.test(firstToken.lyric)) {
          return null;
        }

        // Check if this line has any chords
        const hasChords = line.tokens.some(t => t.chord);

        if (!hasChords) {
          // Pure lyric/text line — render as a single pre-formatted line
          const fullText = line.tokens.map(t => t.lyric).join("");
          return (
            <div key={lineIdx} className="whitespace-pre leading-relaxed min-h-[1.5em]">
              <span className="text-foreground">{fullText || "\u00A0"}</span>
            </div>
          );
        }

        return (
          <div key={lineIdx} className="flex flex-wrap items-end mb-1">
            {line.tokens.map((token, tokenIdx) => (
              <span key={tokenIdx} className="inline-flex flex-col">
                {/* Chord row */}
                <span className="text-primary font-bold text-sm h-5 leading-5 select-none whitespace-pre">
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
        );
      })}
    </div>
  );
}
