import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Share2, Mic, Square, PlayCircle, Music, Sparkles, Search, GripVertical, Loader2 } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const KEYS = ["C", "C#", "D", "Dm", "D#", "E", "Em", "F", "F#", "G", "Gm", "G#", "A", "Am", "A#", "B", "Bm"];
const STYLES = ["Pop", "Rock", "Bossa Nova", "Sertanejo", "MPB", "Worship", "Jazz", "Blues", "Forró", "Reggae"];

const CHORD_MAP: Record<string, string[]> = {
  C: ["C7M", "Dm7", "Em7", "F7M", "G7", "Am7", "Bm7(b5)"],
  D: ["D7M", "Em7", "F#m7", "G7M", "A7", "Bm7", "C#m7(b5)"],
  E: ["E7M", "F#m7", "G#m7", "A7M", "B7", "C#m7", "D#m7(b5)"],
  G: ["G7M", "Am7", "Bm7", "C7M", "D7", "Em7", "F#m7(b5)"],
  A: ["A7M", "Bm7", "C#m7", "D7M", "E7", "F#m7", "G#m7(b5)"],
  Am: ["Am7", "Bm7(b5)", "C7M", "Dm7", "Em7", "F7M", "G7"],
  Em: ["Em7", "F#m7(b5)", "G7M", "Am7", "Bm7", "C7M", "D7"],
  Dm: ["Dm7", "Em7(b5)", "F7M", "Gm7", "Am7", "Bb7M", "C7"],
};

const SAMPLE_CHORDPRO = [
  { chord: "Am7", lyric: "Quando a noite " },
  { chord: "Dm7", lyric: "cai sobre a " },
  { chord: "G7", lyric: "cidade" },
  { chord: null, lyric: "" },
  { chord: "C7M", lyric: "Eu penso em " },
  { chord: "F7M", lyric: "você sem " },
  { chord: "Bm7(b5)", lyric: "saudade" },
  { chord: "E7", lyric: "" },
];

const VOICE_MEMOS = [
  { id: 1, time: "14:30", name: "Batida Bossa" },
  { id: 2, time: "14:45", name: "Melodia Assobio" },
  { id: 3, time: "15:02", name: "Progressão Refrão" },
];

const RHYME_RESULTS = {
  perfect: ["amar", "mar", "lugar", "cantar", "luar"],
  imperfect: ["final", "sinal", "animal", "rical"],
};

export default function CompositionStudioPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [selectedKey, setSelectedKey] = useState("Am");
  const [bpm, setBpm] = useState("120");
  const [style, setStyle] = useState("Bossa Nova");
  const [rhymeSearch, setRhymeSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const { isRecording, isProcessing, chordProText: liveChordPro, audioUrl, currentNote, toggleRecording } = useAudioRecorder();

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const { data, error } = await supabase.functions.invoke("transcribe-composition", {
        body: {
          audio_base64: base64,
          mime_type: audioBlob.type,
          style,
          existing_text: editorText,
        },
      });

      if (error) throw error;

      const transcription = data?.transcription?.trim();
      if (transcription) {
        setEditorText((prev) => (prev ? prev + "\n" : "") + transcription);
        toast.success("Transcrição concluída e inserida no editor!");
      } else {
        toast.warning("Não foi possível transcrever o áudio. Tente novamente.");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast.error("Erro ao transcrever o áudio.");
    } finally {
      setIsTranscribing(false);
    }
  }, [style, editorText]);

  const handleRecordToggle = useCallback(() => {
    toggleRecording(style, (result) => {
      // Append any SpeechRecognition text captured during recording
      if (result.chordProText) {
        setEditorText((prev) => (prev ? prev + "\n" : "") + result.chordProText);
      }
      setSelectedKey(result.detectedKey);
      
      // Send recorded audio to AI for proper transcription
      if (result.audioUrl) {
        fetch(result.audioUrl)
          .then((r) => r.blob())
          .then((blob) => transcribeAudio(blob))
          .catch(console.error);
      }
    });
  }, [style, toggleRecording, transcribeAudio]);

  const displayText = editorText + (isRecording && liveChordPro ? (editorText ? "\n" : "") + liveChordPro : "");

  const chords = CHORD_MAP[selectedKey] || CHORD_MAP["Am"];

  // Parse displayText into renderable ChordPro tokens
  const parsedLines = displayText
    ? displayText.split("\n").map((line) => {
        const tokens: { chord: string | null; lyric: string }[] = [];
        const regex = /\[([^\]]+)\]([^\[]*)/g;
        let match;

        const firstBracket = line.indexOf("[");
        if (firstBracket > 0) {
          tokens.push({ chord: null, lyric: line.slice(0, firstBracket) });
        }

        while ((match = regex.exec(line)) !== null) {
          tokens.push({ chord: match[1], lyric: match[2] });
        }

        if (tokens.length === 0 && line.trim()) {
          tokens.push({ chord: null, lyric: line });
        }

        return tokens;
      })
    : null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ─── Header ─── */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nova Composição..."
              className="bg-transparent text-xl font-bold placeholder:text-muted-foreground focus:outline-none w-full min-w-0 text-foreground"
            />
          </div>

          {/* Center: filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger className="w-24 h-9 bg-secondary border-border text-sm">
                <SelectValue placeholder="Tom" />
              </SelectTrigger>
              <SelectContent>
                {KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-20 h-9 bg-secondary border-border text-sm text-center"
              placeholder="BPM"
            />

            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-36 h-9 bg-secondary border-border text-sm">
                <SelectValue placeholder="Estilo" />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Save className="h-4 w-4" /> Salvar
            </Button>
            <Button size="sm" className="gap-1.5">
              <Share2 className="h-4 w-4" /> Partilhar
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main split ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor – 70% */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24">
          {/* Record button + current note */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <button
              onClick={handleRecordToggle}
              disabled={isProcessing || isTranscribing}
              className={cn(
                "inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold uppercase tracking-wider text-primary-foreground",
                "transition-all duration-300",
                isRecording
                  ? "bg-destructive shadow-[0_0_30px_hsl(var(--destructive)/0.5)] animate-pulse"
                  : (isProcessing || isTranscribing)
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_25px_hsl(195_100%_50%/0.35)] hover:shadow-[0_0_35px_hsl(195_100%_50%/0.55)] hover:scale-105 active:scale-95"
              )}
            >
              {isRecording ? (
                <>
                  <Square className="h-6 w-6" />
                  A gravar... (Clique para parar)
                </>
              ) : isTranscribing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  IA a transcrever o áudio...
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  A finalizar...
                </>
              ) : (
                <>
                  <Mic className="h-6 w-6" />
                  Cantar Nova Ideia
                </>
              )}
            </button>

            {/* Real-time note indicator */}
            {isRecording && currentNote && (
              <div className="flex items-center gap-2 animate-pulse">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Nota detetada:</span>
                <span className="text-2xl font-mono font-black text-primary">{currentNote}</span>
              </div>
            )}
          </div>

          {/* Audio playback after recording */}
          {audioUrl && !isRecording && (
            <div className="mb-6 flex justify-center">
              <audio controls src={audioUrl} className="w-full max-w-md rounded-lg" />
            </div>
          )}

          {/* Editable textarea + ChordPro preview */}
          <div className="rounded-xl border border-border bg-secondary/30 p-6 font-mono min-h-[300px]">
            <textarea
              value={isRecording ? displayText : editorText}
              onChange={(e) => { if (!isRecording) setEditorText(e.target.value); }}
              readOnly={isRecording}
              placeholder="Comece a digitar sua composição ou clique em Cantar Nova Ideia..."
              className="w-full h-96 bg-transparent text-foreground font-mono resize-none focus:outline-none placeholder:text-muted-foreground text-base leading-relaxed"
            />
          </div>

          {/* ChordPro rendered preview */}
          {displayText && (
            <div className="rounded-xl border border-border bg-secondary/30 p-6 font-mono mt-4">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Pré-visualização</p>
              {parsedLines?.map((tokens, lineIdx) => (
                <div key={lineIdx} className="flex flex-wrap items-end mb-4">
                  {tokens.map((token, i) => (
                    <span key={i} className="inline-flex flex-col mr-1 mb-1">
                      <span className="text-primary font-bold text-sm h-5 leading-5 select-none">
                        {token.chord || "\u00A0"}
                      </span>
                      <span className="text-foreground whitespace-pre text-base">
                        {token.lyric || "\u00A0"}
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Mobile toggle for sidebar */}
        <Button
          variant="secondary"
          size="icon"
          className="fixed right-4 bottom-20 z-40 lg:hidden rounded-full h-12 w-12 shadow-lg border border-border"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Sparkles className="h-5 w-5 text-primary" />
        </Button>

        {/* Copilot sidebar – 30% */}
        <aside
          className={cn(
            "w-full lg:w-[30%] lg:max-w-sm border-l border-border bg-card overflow-y-auto pb-24 shrink-0",
            "fixed inset-y-0 right-0 z-30 transition-transform duration-300 lg:relative lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Mobile close */}
          <div className="flex items-center justify-between p-3 border-b border-border lg:hidden">
            <span className="font-bold text-sm text-foreground">Co-piloto IA</span>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>Fechar</Button>
          </div>

          <div className="p-4">
            <Tabs defaultValue="harmony">
              <TabsList className="w-full bg-secondary">
                <TabsTrigger value="harmony" className="flex-1 gap-1.5 text-xs">
                  <Music className="h-3.5 w-3.5" /> Harmonia
                </TabsTrigger>
                <TabsTrigger value="rhymes" className="flex-1 gap-1.5 text-xs">
                  ✍️ Rimas
                </TabsTrigger>
              </TabsList>

              {/* Harmony tab */}
              <TabsContent value="harmony" className="space-y-4 mt-4">
                {/* AI suggestion */}
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary mb-1">Sugestão da IA</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tente uma cadência II-V-I para o refrão:{" "}
                        <span className="text-primary font-mono font-bold">Dm7</span> →{" "}
                        <span className="text-primary font-mono font-bold">G7</span> →{" "}
                        <span className="text-primary font-mono font-bold">C7M</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chord palette */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    Acordes em {selectedKey} • {style}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {chords.map((chord) => (
                      <button
                        key={chord}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-lg border border-border bg-secondary px-2 py-2.5",
                          "text-xs font-mono font-bold text-foreground cursor-grab",
                          "hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                        )}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground opacity-50" />
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Rhymes tab */}
              <TabsContent value="rhymes" className="space-y-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={rhymeSearch}
                    onChange={(e) => setRhymeSearch(e.target.value)}
                    placeholder="Procurar rima para..."
                    className="pl-9 h-9 bg-secondary border-border text-sm"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-primary mb-2">Rimas Perfeitas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RHYME_RESULTS.perfect.map((w) => (
                      <span
                        key={w}
                        className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium cursor-pointer hover:bg-primary/25 transition-colors"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Rimas Imperfeitas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RHYME_RESULTS.imperfect.map((w) => (
                      <span
                        key={w}
                        className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-medium cursor-pointer hover:bg-muted transition-colors"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* ─── Voice Memos Footer ─── */}
      <footer className="shrink-0 border-t border-border bg-card px-4 py-3 bottom-0 lg:bottom-0 bottom-16">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap mr-1">
            🎙️ Cofre de Ideias
          </span>
          {VOICE_MEMOS.map((memo) => (
            <button
              key={memo.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                "bg-secondary border border-border text-foreground",
                "hover:border-primary/40 hover:bg-primary/10 transition-colors"
              )}
            >
              <PlayCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">{memo.time}</span>
              <span>–</span>
              <span>{memo.name}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
