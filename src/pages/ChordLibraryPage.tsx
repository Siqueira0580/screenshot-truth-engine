import { useState, useRef, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import BackButton from "@/components/ui/BackButton";
import { Search, Music4, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import type { Instrument } from "@/lib/chord-diagrams";
import { drawChordDiagram, resolveChordVoicing, resolveAllVoicings } from "@/lib/chord-diagrams";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { toast } from "sonner";

// ─── helpers ──────────────────────────────────────────
function getChordKeysForInstrument(instrument: Instrument): string[] {
  const roots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
  const suffixes =
    instrument === "guitar"
      ? ["", "m", "7", "m7", "Maj7", "dim", "aug", "sus2", "sus4", "7sus4", "add9", "m7b5"]
      : instrument === "cavaquinho"
        ? ["", "m", "7", "m7", "Maj7", "dim", "aug", "sus2", "sus4", "6", "m6", "9", "7sus4", "dim7", "mMaj7", "m9", "Maj9", "7b9", "69"]
        : ["", "m", "7", "m7", "Maj7", "dim", "aug", "sus2", "sus4"];

  const keys: string[] = [];
  for (const root of roots) {
    for (const suffix of suffixes) {
      const name = root + suffix;
      const { voicing } = resolveChordVoicing(name, instrument);
      if (voicing) keys.push(name);
    }
  }
  return Array.from(new Set(keys));
}

const NOTE_NAMES: Record<string, string> = {
  C: "C (Dó)", D: "D (Ré)", E: "E (Mi)", F: "F (Fá)",
  G: "G (Sol)", A: "A (Lá)", B: "B (Si)",
};

const ROOT_ORDER = ["C", "D", "E", "F", "G", "A", "B"];

function getRootNote(chord: string): string {
  const m = chord.match(/^([A-G])/);
  return m ? m[1] : "C";
}

function toRoman(n: number): string {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  let remaining = n;
  for (const [value, numeral] of map) {
    while (remaining >= value) { result += numeral; remaining -= value; }
  }
  return result;
}

// ─── Voicing Detail Modal ─────────────────────────────
function VoicingModal({
  chordName,
  instrument,
  onClose,
}: {
  chordName: string;
  instrument: Instrument;
  onClose: () => void;
}) {
  const { chordPreferences, saveChordPreference } = useUserPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const allVoicings = useMemo(() => resolveAllVoicings(chordName, instrument), [chordName, instrument]);
  const totalVoicings = allVoicings.length;

  const prefKey = `${chordName}::${instrument}`;
  const savedIndex = chordPreferences[prefKey] ?? 0;
  const [voicingIndex, setVoicingIndex] = useState(() => Math.min(savedIndex, Math.max(totalVoicings - 1, 0)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (totalVoicings > 0 && voicingIndex < totalVoicings) {
      drawChordDiagram(canvas, chordName, instrument, allVoicings[voicingIndex], false);
    } else {
      drawChordDiagram(canvas, chordName, instrument);
    }
  }, [chordName, instrument, voicingIndex, totalVoicings, allVoicings]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && totalVoicings > 1)
        setVoicingIndex((i) => (i > 0 ? i - 1 : totalVoicings - 1));
      if (e.key === "ArrowRight" && totalVoicings > 1)
        setVoicingIndex((i) => (i < totalVoicings - 1 ? i + 1 : 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, totalVoicings]);

  const currentVoicing = allVoicings[voicingIndex];
  const baseFret = currentVoicing?.baseFret && currentVoicing.baseFret > 1 ? currentVoicing.baseFret : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-background p-6 shadow-xl animate-in zoom-in-95 duration-200 w-[280px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full p-1 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Chord name */}
        <h3 className="text-xl font-bold text-foreground">{chordName}</h3>

        {/* Canvas */}
        <canvas ref={canvasRef} width={200} height={220} className="rounded" />

        {/* Base fret */}
        {baseFret && (
          <span className="text-xs text-muted-foreground">Casa {toRoman(baseFret)}</span>
        )}

        {/* Navigation */}
        {totalVoicings > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVoicingIndex((i) => (i > 0 ? i - 1 : totalVoicings - 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <span className="text-sm text-muted-foreground tabular-nums font-medium">
              {voicingIndex + 1} / {totalVoicings}
            </span>
            <button
              onClick={() => setVoicingIndex((i) => (i < totalVoicings - 1 ? i + 1 : 0))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={async () => {
                await saveChordPreference(prefKey, voicingIndex);
                toast.success("Posição salva como padrão!");
              }}
              className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${voicingIndex === savedIndex ? "text-primary" : "text-muted-foreground"}`}
              title="Definir como padrão"
            >
              <Star className={`h-4 w-4 ${voicingIndex === savedIndex ? "fill-primary" : ""}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chord Card (grid thumbnail) ──────────────────────
function ChordCardItem({
  chordName,
  instrument,
  onClick,
}: {
  chordName: string;
  instrument: Instrument;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => { setDrawn(false); }, [chordName, instrument]);

  useEffect(() => {
    if (drawn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawChordDiagram(canvas, chordName, instrument);
    setDrawn(true);
  }, [chordName, instrument, drawn]);

  const { voicing } = resolveChordVoicing(chordName, instrument);
  const baseFret = voicing?.baseFret && voicing.baseFret > 1 ? voicing.baseFret : null;
  const allVoicings = resolveAllVoicings(chordName, instrument);
  const hasAlts = allVoicings.length > 1;

  return (
    <Card
      className="border-border/60 bg-card hover:border-primary/30 transition-colors cursor-pointer active:scale-[0.97]"
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center gap-1 relative">
        <p className="font-bold text-base text-foreground text-center leading-tight">
          {chordName}
        </p>
        <canvas ref={canvasRef} width={140} height={160} className="max-w-full" />
        {baseFret && (
          <span className="text-[10px] text-muted-foreground">Casa {toRoman(baseFret)}</span>
        )}
        {hasAlts && (
          <span className="absolute top-2 right-2 text-[9px] bg-primary/15 text-primary font-semibold rounded-full px-1.5 py-0.5">
            {allVoicings.length}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let remaining = n;
  for (const [value, numeral] of map) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

// ─── Main Page ────────────────────────────────────────
const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "cavaquinho", label: "Cavaquinho" },
  { value: "guitar", label: "Violão" },
  { value: "ukulele", label: "Ukulele" },
];

export default function ChordLibraryPage() {
  const [instrument, setInstrument] = useState<Instrument>("cavaquinho");
  const [searchTerm, setSearchTerm] = useState("");

  // Build chord list per instrument (memoized)
  const chordKeys = useMemo(
    () => getChordKeysForInstrument(instrument),
    [instrument]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  // Filter
  const filtered = useMemo(() => {
    if (!normalizedSearch) return chordKeys;
    return chordKeys.filter((k) => k.toLowerCase().includes(normalizedSearch));
  }, [chordKeys, normalizedSearch]);

  // Group by root note
  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const root of ROOT_ORDER) map[root] = [];
    for (const chord of filtered) {
      const root = getRootNote(chord);
      if (!map[root]) map[root] = [];
      map[root].push(chord);
    }
    return map;
  }, [filtered]);

  const isSearching = normalizedSearch.length > 0;

  // When searching, auto-expand all non-empty groups
  const defaultOpen = useMemo(() => {
    if (!isSearching) return [] as string[];
    return ROOT_ORDER.filter((r) => grouped[r]?.length > 0);
  }, [isSearching, grouped]);

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BackButton />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Biblioteca de Acordes
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Explore todas as posições mapeadas por instrumento
          </p>
        </div>
      </div>

      {/* Instrument Tabs */}
      <Tabs
        value={instrument}
        onValueChange={(v) => {
          setInstrument(v as Instrument);
          setSearchTerm("");
        }}
      >
        <TabsList className="w-full sm:w-auto">
          {INSTRUMENTS.map((inst) => (
            <TabsTrigger key={inst.value} value={inst.value} className="flex-1 sm:flex-none">
              {inst.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar acorde (ex: C#m7, Bb)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content for each tab (they share the same layout) */}
        {INSTRUMENTS.map((inst) => (
          <TabsContent key={inst.value} value={inst.value} className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState searchTerm={searchTerm} />
            ) : isSearching ? (
              /* Flat grid when searching */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filtered.map((chord) => (
                  <ChordCardItem key={chord} chordName={chord} instrument={instrument} />
                ))}
              </div>
            ) : (
              /* Accordion grouped by root note */
              <Accordion
                type="multiple"
                defaultValue={defaultOpen}
                className="space-y-2"
              >
                {ROOT_ORDER.map((root) => {
                  const chords = grouped[root];
                  if (!chords || chords.length === 0) return null;
                  return (
                    <AccordionItem key={root} value={root} className="border rounded-lg px-3 border-border/60">
                      <AccordionTrigger className="hover:no-underline">
                        <span className="text-base font-semibold">
                          Acordes de {NOTE_NAMES[root] ?? root}{" "}
                          <span className="text-muted-foreground font-normal text-sm">
                            ({chords.length})
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1 pb-2">
                          {chords.map((chord) => (
                            <ChordCardItem
                              key={chord}
                              chordName={chord}
                              instrument={instrument}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Music4 className="h-12 w-12 text-muted-foreground/50" />
      <p className="text-muted-foreground font-medium">
        Nenhum acorde encontrado para "{searchTerm}"
      </p>
      <p className="text-sm text-muted-foreground/70">
        Tente buscar por outro nome, ex: Am7, G#, Bb
      </p>
    </div>
  );
}
