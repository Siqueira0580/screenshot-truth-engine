import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Save, Share2, Mic, Square, PlayCircle, Music, Sparkles, Search, GripVertical, Loader2, Trash2, FileOutput, X } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { createSong } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { transposeChord } from "@/lib/transpose-chord";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { HARMONIC_FIELDS, getProgressions, getRomanNumeral } from "@/lib/music-theory";

const STYLES = ["Pop", "Rock", "Bossa Nova", "Sertanejo", "Worship", "Samba", "Pagode", "Jazz", "R&B", "MPB", "Blues", "Forró", "Reggae"];

export default function CompositionStudioPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [compositionId, setCompositionId] = useState<string | null>(searchParams.get("id"));
  const [title, setTitle] = useState("");
  const [selectedKey, setSelectedKey] = useState("Am");
  const [originalKey, setOriginalKey] = useState(""); // tom original da composição — vazio até ser definido
  const [targetKey, setTargetKey] = useState(""); // empty = no transposition
  const [bpm, setBpm] = useState("120");
  const [style, setStyle] = useState("Bossa Nova");
  const [composers, setComposers] = useState("");
  const [rhymeSearch, setRhymeSearch] = useState("");
  const [rhymeResults, setRhymeResults] = useState<{ word: string; score: number }[]>([]);
  const [isLoadingRhymes, setIsLoadingRhymes] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [tonePopoverOpen, setTonePopoverOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const rhymeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Export composition as a song to Studio (creates song + audio_tracks) */
  const handleExportToStudio = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para exportar."); return; }
    if (!title && !editorText) { toast.error("Adicione um título ou conteúdo antes de exportar."); return; }

    setIsExporting(true);
    try {
      // 1) Create song
      const song = await createSong({
        title: title || "Sem título",
        body_text: editorText || null,
        musical_key: selectedKey || null,
        bpm: parseInt(bpm) || null,
        style: style || null,
        composer: composers || null,
      });

      // 2) If there's audio, upload to audio-stems and create audio_tracks
      let fileFullUrl: string | null = null;

      if (savedAudioUrl) {
        try {
          const pathMatch = savedAudioUrl.split("/compositions_audio/");
          let blob: Blob | null = null;

          if (pathMatch.length === 2) {
            const storagePath = decodeURIComponent(pathMatch[1]);
            const { data: dlData, error: dlErr } = await supabase.storage
              .from("compositions_audio")
              .download(storagePath);
            if (!dlErr && dlData) {
              blob = dlData;
            }
          }

          if (!blob) {
            const res = await fetch(savedAudioUrl);
            if (res.ok) blob = await res.blob();
          }

          if (blob) {
            const ext = savedAudioUrl.includes(".webm") ? "webm" : savedAudioUrl.includes(".ogg") ? "ogg" : "mp3";
            const path = `${song.id}/full.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("audio-stems")
              .upload(path, blob, { upsert: true, contentType: blob.type || "audio/mpeg" });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("audio-stems").getPublicUrl(path);
              fileFullUrl = urlData.publicUrl;
            } else {
              console.error("Upload to audio-stems failed:", upErr);
            }
          } else {
            console.error("Could not download audio from compositions_audio");
          }
        } catch (audioErr) {
          console.error("Audio export error:", audioErr);
        }
      }

      // 3) Create audio_tracks record
      await supabase.from("audio_tracks").insert({
        song_id: song.id,
        file_full: fileFullUrl,
        user_id: user.id,
      });

      toast.success("Composição exportada para o Estúdio!");
      navigate(`/studio/${song.id}`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar para o Estúdio.");
    } finally {
      setIsExporting(false);
    }
  }, [title, editorText, selectedKey, bpm, style, composers, savedAudioUrl, navigate]);

  // Load existing composition if ID in URL
  useEffect(() => {
    if (!compositionId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("compositions")
        .select("*")
        .eq("id", compositionId)
        .single();
      if (error || !data) return;
      setTitle(data.title || "");
      setEditorText(data.body_text || "");
      setSelectedKey(data.musical_key || "Am");
      setOriginalKey(data.musical_key || "");
      setBpm(String(data.bpm || 120));
      setStyle(data.style || "Bossa Nova");
      setComposers((data as any).composers || "");
      if (data.audio_url) setSavedAudioUrl(data.audio_url);
    };
    load();
  }, [compositionId]);

  /** Transpose all chords inside brackets from detectedKey → targetKey */
  const transposeChordProText = useCallback((text: string, fromKey: string, toKey: string): string => {
    if (!toKey || fromKey === toKey) return text;
    return text.replace(/\[([^\]]+)\]/g, (_match, chord: string) => {
      return `[${transposeChord(chord, fromKey, toKey)}]`;
    });
  }, []);

  // Core save logic — returns the composition id
  const persistComposition = useCallback(async (opts: { silent?: boolean; uploadAudio?: boolean } = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (!opts.silent) toast.error("Faça login para salvar sua composição.");
      return null;
    }

    setIsSaving(true);
    try {
      // 1) Upload audio if requested and available
      let audioUrl: string | null = null;
      if (opts.uploadAudio && audioBlobRef.current) {
        const ext = audioBlobRef.current.type.includes("webm") ? "webm" : "ogg";
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("compositions_audio")
          .upload(fileName, audioBlobRef.current, { contentType: audioBlobRef.current.type });
        if (uploadErr) {
          console.error("Audio upload error:", uploadErr);
        } else {
          const { data: urlData } = supabase.storage
            .from("compositions_audio")
            .getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;
        }
      }

      // 2) Save to DB
      const payload: Record<string, unknown> = {
        title: title || "Sem título",
        body_text: editorText,
        musical_key: selectedKey,
        bpm: parseInt(bpm) || 120,
        style,
        composers: composers || null,
        user_id: user.id,
      };
      if (audioUrl) payload.audio_url = audioUrl;

      if (compositionId) {
        const { error } = await supabase.from("compositions").update(payload as any).eq("id", compositionId);
        if (error) throw error;
        return compositionId;
      } else {
        const { data, error } = await supabase.from("compositions").insert(payload as any).select("id").single();
        if (error) throw error;
        setCompositionId(data.id);
        setSearchParams({ id: data.id }, { replace: true });
        return data.id;
      }
    } catch (err) {
      console.error("Save error:", err);
      if (!opts.silent) toast.error("Erro ao salvar a composição.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [title, editorText, selectedKey, bpm, style, composers, compositionId, setSearchParams]);

  // Manual save — NO LONGER navigates, just shows toast
  const handleSave = useCallback(async () => {
    const id = await persistComposition({ uploadAudio: true });
    if (id) {
      toast.success(compositionId ? "Cifra salva!" : "Composição salva!");
    }
  }, [persistComposition, compositionId]);

  // Exit button — saves FIRST, then navigates
  const handleExit = useCallback(async () => {
    await persistComposition({ silent: true, uploadAudio: true });
    navigate("/compositions");
  }, [persistComposition, navigate]);

  // Auto-save refs (effect placed after useAudioRecorder below)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (title || editorText || composers) hasInteracted.current = true;
  }, [title, editorText, composers]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAudioModal, setShowDeleteAudioModal] = useState(false);

  const handleDeleteAudio = useCallback(async () => {
    try {
      if (savedAudioUrl) {
        const path = savedAudioUrl.split("/compositions_audio/")[1];
        if (path) {
          await supabase.storage.from("compositions_audio").remove([decodeURIComponent(path)]);
        }
        if (compositionId) {
          await supabase.from("compositions").update({ audio_url: null } as any).eq("id", compositionId);
        }
      }
      setSavedAudioUrl(null);
      audioBlobRef.current = null;
      toast.success("Áudio excluído com sucesso.");
    } catch (err) {
      console.error("Delete audio error:", err);
      toast.error("Erro ao excluir o áudio.");
    }
  }, [savedAudioUrl, compositionId]);

  const handleDelete = useCallback(async () => {
    if (!compositionId) return;
    try {
      const { error } = await supabase.from("compositions").delete().eq("id", compositionId);
      if (error) throw error;
      toast.success("Composição apagada.");
      navigate("/compositions");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao apagar a composição.");
    }
  }, [compositionId, navigate]);

  const { isRecording, isProcessing, chordProText: liveChordPro, audioUrl, currentNote, toggleRecording } = useAudioRecorder();

  // ─── Auto-save (debounced 10s) ───
  useEffect(() => {
    if (!hasInteracted.current || isRecording || isTranscribing) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      persistComposition({ silent: true });
    }, 10000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, editorText, selectedKey, bpm, style, composers, persistComposition, isRecording, isTranscribing]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
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

      let transcription = data?.transcription?.trim();
      if (transcription) {
        const detectedKey = data?.detected_key || selectedKey;
        if (!originalKey && detectedKey) {
          setOriginalKey(detectedKey);
        }
        if (targetKey && targetKey !== detectedKey) {
          transcription = transposeChordProText(transcription, detectedKey, targetKey);
          setSelectedKey(targetKey);
        } else if (detectedKey) {
          setSelectedKey(detectedKey);
        }

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
  }, [style, editorText, selectedKey, targetKey, transposeChordProText]);

  const handleRecordToggle = useCallback(() => {
    toggleRecording(style, (result) => {
      if (result.audioUrl) {
        fetch(result.audioUrl)
          .then((r) => r.blob())
          .then((blob) => {
            audioBlobRef.current = blob;
            transcribeAudio(blob);
          })
          .catch(console.error);
      }
    });
  }, [style, toggleRecording, transcribeAudio]);

  // Handle tone selection from the unified popover
  const handleToneSelect = useCallback((newKey: string) => {
    // If there's text with chords, transpose from current to new key
    if (editorText.includes("[") && newKey !== selectedKey) {
      setEditorText((prev) => transposeChordProText(prev, selectedKey, newKey));
      toast.success(`Transposto de ${selectedKey} para ${newKey}`);
    }
    setSelectedKey(newKey);
    setTonePopoverOpen(false);
  }, [editorText, selectedKey, transposeChordProText]);

  const displayText = editorText + (isRecording && liveChordPro ? (editorText ? "\n" : "") + liveChordPro : "");

  const chords = HARMONIC_FIELDS[selectedKey] || HARMONIC_FIELDS["Am"] || [];
  const progressions = getProgressions(selectedKey);
  const isMinor = selectedKey.endsWith("m");

  // ─── Rhyme fetch (RhymeBrain API, debounced 500ms) ───
  const fetchRhymes = useCallback(async (word: string) => {
    if (!word.trim()) { setRhymeResults([]); return; }
    setIsLoadingRhymes(true);
    try {
      const res = await fetch(`https://rhymebrain.com/talk?function=getRhymes&word=${encodeURIComponent(word.trim())}&lang=pt`);
      const data = await res.json();
      const filtered = (data as { word: string; score: number }[])
        .filter((r) => r.score > 250)
        .slice(0, 30);
      setRhymeResults(filtered);
    } catch (err) {
      console.error("Rhyme fetch error:", err);
      toast.error("Erro ao buscar rimas.");
      setRhymeResults([]);
    } finally {
      setIsLoadingRhymes(false);
    }
  }, []);

  useEffect(() => {
    if (rhymeTimerRef.current) clearTimeout(rhymeTimerRef.current);
    if (!rhymeSearch.trim()) { setRhymeResults([]); return; }
    rhymeTimerRef.current = setTimeout(() => fetchRhymes(rhymeSearch), 500);
    return () => { if (rhymeTimerRef.current) clearTimeout(rhymeTimerRef.current); };
  }, [rhymeSearch, fetchRhymes]);

  const handleCopyRhyme = useCallback((word: string) => {
    navigator.clipboard.writeText(word).then(() => {
      toast.success(`"${word}" copiada!`);
    }).catch(() => toast.error("Erro ao copiar."));
  }, []);

  // ─── Clear page handler ───
  const handleClearPage = useCallback(() => {
    setEditorText("");
    setSelectedKey("Am");
    setOriginalKey("");
    setTitle("");
    setComposers("");
    setBpm("120");
    setSavedAudioUrl(null);
    audioBlobRef.current = null;
    setShowClearModal(false);
    toast.success("Composição limpa!");
  }, []);

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

  // Major keys for the popover grid (12 major + 12 minor)
  const MAJOR_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MINOR_KEYS = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ─── Header ─── */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: exit + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="outline" size="icon" onClick={handleExit} title="Salvar e sair">
              <X className="h-5 w-5" />
            </Button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da Composição..."
              className="bg-transparent text-xl font-bold placeholder:text-muted-foreground focus:outline-none w-full min-w-0 text-foreground"
            />
            <input
              value={composers}
              onChange={(e) => setComposers(e.target.value)}
              placeholder="Compositores..."
              className="bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none w-full min-w-0 text-muted-foreground"
            />
          </div>

          {/* Center: filters — SINGLE tone button + BPM + style */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unified Tone Popover */}
            <Popover open={tonePopoverOpen} onOpenChange={setTonePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9 px-3">
                  <Music className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold">{selectedKey}</span>
                  {originalKey && originalKey !== selectedKey && (
                    <span className="text-[10px] text-muted-foreground ml-0.5">(orig: {originalKey})</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Tom / Transposição</p>
                    {originalKey && (
                      <span className="text-[11px] text-[hsl(var(--accent))] font-medium">
                        Original: {originalKey}
                      </span>
                    )}
                  </div>

                  {/* Set original key if not set */}
                  {!originalKey && (
                    <p className="text-xs text-muted-foreground">
                      Selecione o tom original da composição. Ele será destacado em ciano.
                    </p>
                  )}

                  {/* Major keys */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Maiores</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MAJOR_KEYS.map((k) => {
                        const isOriginal = originalKey === k;
                        const isCurrent = selectedKey === k;
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              if (!originalKey) setOriginalKey(k);
                              handleToneSelect(k);
                            }}
                            className={cn(
                              "rounded-md px-1.5 py-1.5 text-xs font-mono font-bold transition-all text-center",
                              isOriginal
                                ? "bg-[hsl(195_100%_50%/0.15)] text-[hsl(195_100%_50%)] border border-[hsl(195_100%_50%/0.5)] shadow-[0_0_8px_hsl(195_100%_50%/0.2)]"
                                : isCurrent
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Minor keys */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Menores</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MINOR_KEYS.map((k) => {
                        const isOriginal = originalKey === k;
                        const isCurrent = selectedKey === k;
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              if (!originalKey) setOriginalKey(k);
                              handleToneSelect(k);
                            }}
                            className={cn(
                              "rounded-md px-1.5 py-1.5 text-xs font-mono font-bold transition-all text-center",
                              isOriginal
                                ? "bg-[hsl(195_100%_50%/0.15)] text-[hsl(195_100%_50%)] border border-[hsl(195_100%_50%/0.5)] shadow-[0_0_8px_hsl(195_100%_50%/0.2)]"
                                : isCurrent
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            {k}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reset original key */}
                  {originalKey && (
                    <button
                      onClick={() => {
                        handleToneSelect(originalKey);
                      }}
                      className="w-full text-xs text-[hsl(195_100%_50%)] hover:underline text-center pt-1"
                    >
                      ↩ Voltar ao tom original ({originalKey})
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

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
            <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => setShowClearModal(true)} title="Limpar página">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Salvando..." : compositionId ? "Salvar" : "Salvar Composição"}
            </Button>
            <Button size="sm" className="gap-1.5" variant="secondary" onClick={handleExportToStudio} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}
              {isExporting ? "Exportando..." : "Enviar ao Estúdio"}
            </Button>
            <Button size="sm" className="gap-1.5">
              <Share2 className="h-4 w-4" /> Partilhar
            </Button>
            {compositionId && (
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
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
          {(audioUrl || savedAudioUrl) && !isRecording && (
            <div className="mb-6 flex flex-col items-center gap-2">
              <audio controls src={audioUrl || savedAudioUrl || undefined} className="w-full max-w-md rounded-lg" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
                onClick={() => setShowDeleteAudioModal(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir áudio
              </Button>
            </div>
          )}

          {/* Editable textarea */}
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

              <TabsContent value="harmony" className="space-y-4 mt-4">
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

                <p className="text-xs text-muted-foreground text-center py-4">
                  Digite uma palavra acima para buscar rimas.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap mr-1">
            🎙️ Cofre de Ideias
          </span>
          {(audioUrl || savedAudioUrl) && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-secondary border border-border text-foreground">
              <PlayCircle className="h-3.5 w-3.5 text-primary" />
              Gravação atual
            </span>
          )}
          {!audioUrl && !savedAudioUrl && (
            <span className="text-xs text-muted-foreground">Nenhuma gravação ainda.</span>
          )}
        </div>
      </footer>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDelete}
        title="Apagar Composição"
        description="Tem certeza que deseja apagar esta composição? Esta ação não pode ser desfeita."
      />

      <ConfirmDeleteModal
        open={showDeleteAudioModal}
        onOpenChange={setShowDeleteAudioModal}
        onConfirm={handleDeleteAudio}
        title="Excluir Áudio"
        description="Tem certeza que deseja excluir o áudio gravado? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
