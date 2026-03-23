import { useMemo } from "react";
import { parseChordsInText } from "@/lib/chord-parser";
import { isChordProFormat } from "@/lib/chordpro-parser";
import ChordHighlight from "@/components/ChordHighlight";
import ChordProDisplay from "@/components/ChordProDisplay";

interface ChordTextProps {
  text: string;
  className?: string;
}

/**
 * Renders song body text with interactive chord highlights.
 * Auto-detects ChordPro format ([Chord]lyric) and renders chords above syllables.
 * Falls back to inline chord highlighting for plain text.
 */
export default function ChordText({ text, className }: ChordTextProps) {
  const isChordPro = useMemo(() => isChordProFormat(text), [text]);
  const lines = useMemo(() => text.split("\n"), [text]);

  if (isChordPro) {
    return (
      <div className={className}>
        <ChordProDisplay text={text} className="font-mono text-lg leading-relaxed" />
      </div>
    );
  }

  return (
    <pre className={`${className ?? ""} whitespace-pre-wrap font-mono`} style={{ tabSize: 8 }}>
      {lines.map((line, lineIdx) => (
        <ChordLine key={lineIdx} line={line} isLast={lineIdx === lines.length - 1} />
      ))}
    </pre>
  );
}

function ChordLine({ line, isLast }: { line: string; isLast: boolean }) {
  const segments = useMemo(() => parseChordsInText(line), [line]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "chord" ? (
          <ChordHighlight key={i} chord={seg.content} />
        ) : (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>{seg.content}</span>
        )
      )}
      {!isLast && "\n"}
    </>
  );
}
