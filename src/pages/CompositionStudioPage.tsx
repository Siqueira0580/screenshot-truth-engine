import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Save, Share2, Mic, Square, Music, Sparkles, Search, Loader2, Trash2, ArrowLeft, UserPlus, Eraser, Headphones, Pause, Code, Eye } from "lucide-react";
import InviteCollaboratorModal from "@/components/InviteCollaboratorModal";
import AudioTakesList, { type AudioTake } from "@/components/AudioTakesList";
import { useAuth } from "@/contexts/AuthContext";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { transposeChord } from "@/lib/transpose-chord";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { HARMONIC_FIELDS, getProgressions, getRomanNumeral } from "@/lib/music-theory";

const STYLES = ["Pop", "Rock", "Bossa Nova", "Sertanejo", "Worship", "Samba", "Pagode", "Jazz", "R&B", "MPB", "Blues", "Forró", "Reggae"];

export default function CompositionStudioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [compositionId, setCompositionId] = useState<string | null>(searchParams.get("id"));
  const [compositionOwnerId, setCompositionOwnerId] = useState<string | null>(null);
  const [sharedWithEmails, setSharedWithEmails] = useState<string[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [originalKey, setOriginalKey] = useState(""); // tom original da composição — vazio até ser definido
  const [targetKey, setTargetKey] = useState(""); // empty = no transposition
  const [bpm, setBpm] = useState("120");
  const [style, setStyle] = useState("Bossa Nova");
  const [composers, setComposers] = useState("");
  const [rhymeSearch, setRhymeSearch] = useState("");
  const [rhymeResults, setRhymeResults] = useState<string[]>([]);
  const [isLoadingRhymes, setIsLoadingRhymes] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [audioTakes, setAudioTakes] = useState<AudioTake[]>([]);
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
      const song = await createSong({
        title: title || "Sem título",
        body_text: editorText || null,
        musical_key: selectedKey || null,
        bpm: parseInt(bpm) || null,
        style: style || null,
        composer: composers || null,
      });

      // Use first audio take if available
      let fileFullUrl: string | null = null;
      const firstTake = audioTakes[0];

      if (firstTake?.url) {
        try {
          const res = await fetch(firstTake.url);
          if (res.ok) {
            const blob = await res.blob();
            const ext = firstTake.url.includes(".webm") ? "webm" : firstTake.url.includes(".ogg") ? "ogg" : "mp3";
            const path = `${song.id}/full.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("audio-stems")
              .upload(path, blob, { upsert: true, contentType: blob.type || "audio/mpeg" });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("audio-stems").getPublicUrl(path);
              fileFullUrl = urlData.publicUrl;
            }
          }
        } catch (audioErr) {
          console.error("Audio export error:", audioErr);
        }
      }

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
  }, [title, editorText, selectedKey, bpm, style, composers, audioTakes, navigate]);

  const isOwner = !compositionId || compositionOwnerId === user?.id;

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
      setSelectedKey(data.musical_key || "");
      setOriginalKey(data.musical_key || "");
      setBpm(String(data.bpm || 120));
      setStyle(data.style || "Bossa Nova");
      setComposers((data as any).composers || "");
      // Load audio takes from composition_audios table
      const { data: takesData } = await supabase
        .from("composition_audios" as any)
        .select("*")
        .eq("composition_id", compositionId)
        .order("created_at", { ascending: false });
      if (takesData && (takesData as any[]).length > 0) {
        setAudioTakes((takesData as any[]).map((t: any) => ({
          id: t.id,
          url: t.audio_url,
          title: t.title || "",
          createdAt: t.created_at,
        })));
      }
      setCompositionOwnerId(data.user_id);
      setSharedWithEmails((data as any).shared_with_emails || []);
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
    navigate(-1);
  }, [persistComposition, navigate]);

  // Auto-save refs (effect placed after useAudioRecorder below)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (title || editorText || composers) hasInteracted.current = true;
  }, [title, editorText, composers]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteTake = useCallback(async (takeId: string) => {
    try {
      const take = audioTakes.find((t) => t.id === takeId);
      if (take?.url) {
        const path = take.url.split("/compositions_audio/")[1];
        if (path) {
          await supabase.storage.from("compositions_audio").remove([decodeURIComponent(path)]);
        }
      }
      await supabase.from("composition_audios" as any).delete().eq("id", takeId);
      setAudioTakes((prev) => prev.filter((t) => t.id !== takeId));
      toast.success("Gravação excluída.");
    } catch (err) {
      console.error("Delete take error:", err);
      toast.error("Erro ao excluir a gravação.");
    }
  }, [audioTakes]);

  const handleRenameTake = useCallback(async (takeId: string, newTitle: string) => {
    setAudioTakes((prev) => prev.map((t) => t.id === takeId ? { ...t, title: newTitle } : t));
    await supabase.from("composition_audios" as any).update({ title: newTitle }).eq("id", takeId);
  }, []);

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

  const { recordingState, audioUrl: recorderAudioUrl, currentNote, startRecording, pauseRecording, resumeRecording, stopRecording, getResult } = useAudioRecorder();

  const isActiveRecording = recordingState === "recording" || recordingState === "paused";

  // ─── Auto-save (debounced 10s) ───
  useEffect(() => {
    if (!hasInteracted.current || isActiveRecording || isTranscribing) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      persistComposition({ silent: true });
    }, 10000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, editorText, selectedKey, bpm, style, composers, persistComposition, isActiveRecording, isTranscribing]);

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

  // When recording finishes (state changes to "recorded"), auto-transcribe
  const prevRecordingState = useRef(recordingState);
  useEffect(() => {
    if (prevRecordingState.current !== "recorded" && recordingState === "recorded") {
      const result = getResult();
      if (result) {
        audioBlobRef.current = result.audioBlob;
        transcribeAudio(result.audioBlob);

        // Save audio take to storage + DB
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Ensure composition is persisted first
          let compId = compositionId;
          if (!compId) {
            const id = await persistComposition({ silent: true });
            if (!id) return;
            compId = id;
          }

          const ext = result.audioBlob.type.includes("webm") ? "webm" : "ogg";
          const fileName = `${user.id}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("compositions_audio")
            .upload(fileName, result.audioBlob, { contentType: result.audioBlob.type });
          if (uploadErr) { console.error("Upload error:", uploadErr); return; }

          const { data: urlData } = supabase.storage.from("compositions_audio").getPublicUrl(fileName);
          const now = new Date();
          const autoTitle = `Ideia - ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

          const { data: inserted, error: dbErr } = await supabase
            .from("composition_audios" as any)
            .insert({
              composition_id: compId,
              user_id: user.id,
              title: autoTitle,
              audio_url: urlData.publicUrl,
            })
            .select()
            .single();

          if (!dbErr && inserted) {
            const row = inserted as any;
            setAudioTakes((prev) => [{
              id: row.id,
              url: row.audio_url,
              title: row.title,
              createdAt: row.created_at,
            }, ...prev]);
          }
        })();
      }
    }
    prevRecordingState.current = recordingState;
  }, [recordingState, getResult, transcribeAudio, compositionId, persistComposition]);

  // Master button handler
  const handleMasterButton = useCallback(() => {
    if (recordingState === "idle" || recordingState === "recorded") {
      startRecording();
    } else if (recordingState === "recording") {
      pauseRecording();
    } else if (recordingState === "paused") {
      resumeRecording();
    }
  }, [recordingState, startRecording, pauseRecording, resumeRecording]);


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

  const displayText = editorText;

  // Harmony tab uses its own independent key
  const [harmonyKey, setHarmonyKey] = useState("C");
  const harmonyChords = HARMONIC_FIELDS[harmonyKey] || [];
  const harmonyProgressions = getProgressions(harmonyKey);
  const isHarmonyMinor = harmonyKey.endsWith("m");

  // ─── Rhyme generation via AI (Edge Function) ───
  const fetchRhymes = useCallback(async (word: string) => {
    if (!word.trim()) { setRhymeResults([]); return; }
    setIsLoadingRhymes(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-rhymes", {
        body: { word: word.trim() },
      });
      if (error) throw error;
      const rhymes = Array.isArray(data?.rhymes) ? data.rhymes.filter((r: unknown) => typeof r === "string") : [];
      setRhymeResults(rhymes);
    } catch (err) {
      console.error("Rhyme generation error:", err);
      toast.error("Não foi possível gerar rimas no momento.");
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
    setSelectedKey("");
    setOriginalKey("");
    setTitle("");
    setComposers("");
    setBpm("120");
    setAudioTakes([]);
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
          {/* Left: exit + title column */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Button type="button" variant="ghost" size="icon" onClick={handleExit} className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col flex-1 min-w-0">
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
                className="bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none w-full min-w-0 text-muted-foreground mt-0.5"
              />
            </div>
          </div>

          {/* Center: filters — SINGLE tone button + BPM + style */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unified Tone Popover */}
            <Popover open={tonePopoverOpen} onOpenChange={setTonePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9 px-3">
                  <Music className="h-4 w-4 text-primary" />
                  {selectedKey ? (
                    <>
                      <span className="font-mono font-bold">{selectedKey}</span>
                      {originalKey && originalKey !== selectedKey && (
                        <span className="text-[10px] text-muted-foreground ml-0.5">(orig: {originalKey})</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">Definir Tom</span>
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

          {/* Right: share dropdown */}
          <div className="flex items-center gap-2">
            {isOwner && compositionId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowInviteModal(true)} className="gap-2 cursor-pointer">
                    <UserPlus className="h-4 w-4" />
                    Convidar Parceiro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportToStudio} disabled={isExporting} className="gap-2 cursor-pointer">
                    <Headphones className="h-4 w-4" />
                    {isExporting ? "Exportando..." : "Enviar para o Estúdio"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!isOwner && (
              <Button size="sm" className="gap-1.5" variant="secondary" onClick={handleExportToStudio} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                {isExporting ? "Exportando..." : "Enviar ao Estúdio"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main split ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor – 70% */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 relative">
          {/* ─── Horizontal Toolbar above editor ─── */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-between mb-4">
              {/* ─── Recording Control: [ Rec/Pause ] — [ Stop ] ─── */}
              <div className="flex items-center gap-6">
                {/* CENTER: Master Record/Pause button */}
                <div className="flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleMasterButton}
                        disabled={isTranscribing}
                        className={cn(
                          "relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 focus:outline-none",
                          recordingState === "recording"
                            ? "bg-destructive/20 border-2 border-destructive shadow-[0_0_20px_hsl(var(--destructive)/0.4)] animate-pulse"
                            : recordingState === "paused"
                              ? "bg-accent/20 border-2 border-accent"
                              : isTranscribing
                                ? "bg-muted border-2 border-border cursor-not-allowed"
                                : "bg-primary/10 border-2 border-primary/50 shadow-[0_0_16px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_24px_hsl(var(--primary)/0.45)] hover:scale-105 active:scale-95"
                        )}
                      >
                        {recordingState === "recording" ? (
                          <Pause className="h-7 w-7 text-destructive" />
                        ) : isTranscribing ? (
                          <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
                        ) : (
                          <Mic className="h-7 w-7 text-primary" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>
                        {recordingState === "recording" ? "Pausar" : recordingState === "paused" ? "Continuar" : isTranscribing ? "A transcrever..." : "Gravar"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {recordingState === "recording" && (
                    <span className="text-xs font-medium text-destructive animate-pulse">Compondo...</span>
                  )}
                  {recordingState === "paused" && (
                    <span className="text-xs font-medium text-muted-foreground">Pausado — Clique para continuar</span>
                  )}
                  {isTranscribing && (
                    <span className="text-xs font-medium text-muted-foreground">IA a transcrever...</span>
                  )}
                </div>

                {/* RIGHT: Stop button — only during recording/paused */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={stopRecording}
                      disabled={!isActiveRecording}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border transition-all",
                        isActiveRecording
                          ? "border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20 hover:scale-105"
                          : "border-border text-muted-foreground/40 bg-muted/30 cursor-not-allowed"
                      )}
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Parar gravação</p></TooltipContent>
                </Tooltip>

                {/* Current note indicator */}
                {isActiveRecording && currentNote && (
                  <div className="flex items-center gap-1.5 ml-2 animate-pulse">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Nota:</span>
                    <span className="text-lg font-mono font-black text-primary">{currentNote}</span>
                  </div>
                )}
              </div>

              {/* Right: editor tool icons */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] transition-all"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Salvar</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      onClick={() => setShowClearModal(true)}
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Limpar</p></TooltipContent>
                </Tooltip>

                {isOwner && compositionId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/20 transition-all"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Excluir</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </TooltipProvider>

          {/* ─── Audio Takes List (Gaveta de Ideias) ─── */}
          {audioTakes.length > 0 && !isActiveRecording && (
            <div className="mb-6">
              <AudioTakesList
                takes={audioTakes}
                onRename={handleRenameTake}
                onDelete={handleDeleteTake}
              />
            </div>
          )}

          {/* Toggle Editor / Preview button */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowEditor(!showEditor)}
            >
              {showEditor ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
              {showEditor ? "Ver Cifra" : "Editar Cifra / Letra"}
            </Button>
          </div>

          {/* Editable textarea — shown when showEditor is true OR no content */}
          {(showEditor || !editorText.trim()) && (
            <div className="rounded-xl border border-border bg-secondary/30 p-6 font-mono min-h-[300px]">
              <textarea
                value={editorText}
                onChange={(e) => { if (!isActiveRecording) setEditorText(e.target.value); }}
                readOnly={isActiveRecording}
                placeholder="Comece a digitar sua composição ou clique no botão de microfone..."
                className="w-full h-96 bg-transparent text-foreground font-mono resize-none focus:outline-none placeholder:text-muted-foreground text-base leading-relaxed"
              />
            </div>
          )}

          {/* ChordPro rendered preview — always visible when there's content and editor is hidden */}
          {displayText && !showEditor && (
            <div className="rounded-xl border border-border bg-secondary/30 p-6 font-mono">
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
                {/* Independent key selector for harmony exploration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Explorar progressões em:</label>
                  <Select value={harmonyKey} onValueChange={setHarmonyKey}>
                    <SelectTrigger className="w-full h-9 bg-secondary border-border text-sm font-mono font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map((k) => (
                        <SelectItem key={k} value={k}>{k} Maior</SelectItem>
                      ))}
                      {["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"].map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* AI Progressions — dynamic based on harmonyKey */}
                {harmonyProgressions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-xs font-semibold text-primary">Sugestões de Progressão em {harmonyKey}</p>
                    </div>
                    {harmonyProgressions.map((prog, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const chordLine = prog.chords.map(c => `[${c}]`).join(" ");
                          setEditorText(prev => prev ? prev + "\n" + chordLine : chordLine);
                          toast.success(`Progressão "${prog.name}" inserida!`);
                        }}
                        className="w-full rounded-lg bg-primary/10 border border-primary/20 p-3 text-left hover:bg-primary/20 transition-colors"
                      >
                        <p className="text-[11px] font-semibold text-primary">{prog.name}</p>
                        <p className="text-[10px] text-muted-foreground mb-1">{prog.numerals}</p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {prog.chords.join(" → ")}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    Campo Harmônico de {harmonyKey}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {harmonyChords.map((chord, idx) => (
                      <button
                        key={chord}
                        onClick={() => {
                          setEditorText(prev => prev ? prev + `[${chord}]` : `[${chord}]`);
                          toast.success(`${chord} inserido!`);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border border-border bg-secondary px-2 py-2.5",
                          "text-xs font-mono font-bold text-foreground",
                          "hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                        )}
                      >
                        <span className="text-[9px] text-muted-foreground font-normal mb-0.5">
                          {getRomanNumeral(idx, isHarmonyMinor)}
                        </span>
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
                    placeholder="Digite uma palavra para rimar..."
                    className="pl-9 h-9 bg-secondary border-border text-sm"
                  />
                </div>

                {isLoadingRhymes && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-xs text-muted-foreground">Gerando rimas com IA...</span>
                  </div>
                )}

                {!isLoadingRhymes && rhymeResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {rhymeResults.map((word) => (
                      <button
                        key={word}
                        onClick={() => handleCopyRhyme(word)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium border border-border bg-secondary text-foreground",
                          "hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors",
                          "active:scale-95"
                        )}
                        title="Clique para copiar"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                )}

                {!isLoadingRhymes && rhymeResults.length === 0 && rhymeSearch.trim() && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhuma rima encontrada para "{rhymeSearch}".
                  </p>
                )}

                {!rhymeSearch.trim() && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Digite uma palavra acima para buscar rimas. Clique numa rima para copiá-la.
                  </p>
                )}
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


      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDelete}
        title="Apagar Composição"
        description="Tem certeza que deseja apagar esta composição? Esta ação não pode ser desfeita."
      />

      <ConfirmDeleteModal
        open={showClearModal}
        onOpenChange={setShowClearModal}
        onConfirm={handleClearPage}
        title="Limpar prancheta?"
        description="Tem certeza de que deseja apagar toda a sua composição atual? Esta ação não poderá ser desfeita e você perderá o texto não salvo."
      />

      {compositionId && (
        <InviteCollaboratorModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          compositionId={compositionId}
          currentEmails={sharedWithEmails}
          onUpdated={setSharedWithEmails}
        />
      )}
    </div>
  );
}
