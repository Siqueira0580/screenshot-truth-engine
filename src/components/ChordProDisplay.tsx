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
    <div className={className}>
      {lines.map((line, lineIdx) => {
        // Filter out directive lines like {title:...}
        const firstToken = line.tokens[0];
        if (firstToken && !firstToken.chord && /^\s*\{[^}]+\}\s*$/.test(firstToken.lyric)) {
          return null;
        }

        return (
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
        );
      })}
    </div>
  );
}
