import { useMemo } from "react";
import { parseChordsInText, TextSegment } from "@/lib/chord-parser";
import ChordHighlight from "@/components/ChordHighlight";

interface ChordTextProps {
  text: string;
  className?: string;
}

/**
 * Renders song body text with interactive chord highlights.
 * Each line is parsed independently to preserve whitespace/formatting.
 */
export default function ChordText({ text, className }: ChordTextProps) {
  const lines = useMemo(() => text.split("\n"), [text]);

  return (
    <pre className={className}>
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
          <span key={i}>{seg.content}</span>
        )
      )}
      {!isLast && "\n"}
    </>
  );
}
