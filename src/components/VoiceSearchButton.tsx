import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { checkDuplicateSong } from "@/lib/supabase-queries";

type VoiceState = "idle" | "listening" | "searching" | "importing";

export default function VoiceSearchButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const importCifra = useCallback(async (query: string) => {
    if (!user) {
      toast.error("Faça login para importar cifras");
      return;
    }

    setState("searching");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-cifra", {
        body: { query },
      });

      if (error) throw new Error("Falha na comunicação com o servidor.");

      if (!data || data.success === false) {
        toast.error(data?.error || "Não foi possível importar a música.");
        setState("idle");
        setTranscript("");
        return;
      }

      if (!data.title) {
        toast.error("Cifra não encontrada.");
        setState("idle");
        setTranscript("");
        return;
      }

      setState("importing");

      // Check duplicate
      const dupId = await checkDuplicateSong(data.title, data.artist || null);
      if (dupId) {
        toast.info("Música já existe no seu repertório!", { description: data.title });
        navigate(`/songs/${dupId}`);
        setState("idle");
        return;
      }

      // Insert song
      const { data: newSong, error: insertErr } = await supabase
        .from("songs")
        .insert({
          title: data.title,
          artist: data.artist || null,
          body_text: data.content || null,
          musical_key: data.musical_key || null,
          style: data.style || null,
          bpm: data.bpm || null,
          composer: data.composer || null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // Add to user library
      await supabase.from("user_library").insert({
        user_id: user.id,
        song_id: newSong.id,
      });

      queryClient.invalidateQueries({ queryKey: ["user-library"] });
      toast.success("Cifra importada com sucesso!", {
        description: `${data.title}${data.artist ? ` – ${data.artist}` : ""}`,
      });
      navigate(`/songs/${newSong.id}`);
    } catch (err: any) {
      console.error("Voice import error:", err);
      toast.error(err.message || "Erro ao importar cifra");
    } finally {
      setState("idle");
      setTranscript("");
    }
  }, [user, navigate, queryClient]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Tente no Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal && text.trim()) {
        stopListening();
        importCifra(text.trim());
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Speech error:", e.error);
      if (e.error !== "aborted") {
        toast.error("Erro no reconhecimento de voz. Tente novamente.");
      }
      setState("idle");
      setTranscript("");
    };

    recognition.onend = () => {
      if (state === "listening") {
        // Ended without final result
        if (transcript.trim()) {
          importCifra(transcript.trim());
        } else {
          setState("idle");
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [importCifra, stopListening, state, transcript]);

  const handleClick = () => {
    if (state === "listening") {
      stopListening();
      if (transcript.trim()) {
        importCifra(transcript.trim());
      } else {
        setState("idle");
      }
    } else if (state === "idle") {
      startListening();
    }
  };

  const isWorking = state === "searching" || state === "importing";

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        size="icon"
        variant={state === "listening" ? "destructive" : "default"}
        className={cn(
          "h-10 w-10 rounded-full transition-all",
          state === "listening" && "animate-pulse shadow-[0_0_16px_hsl(var(--destructive)/0.5)]",
          isWorking && "pointer-events-none opacity-70"
        )}
        onClick={handleClick}
        disabled={isWorking}
        title="Buscar cifra por voz"
      >
        {isWorking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "listening" ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {(state !== "idle" || transcript) && (
        <p className="text-xs text-muted-foreground text-center max-w-[200px] truncate">
          {state === "listening" && (transcript || "Fale o nome da música...")}
          {state === "searching" && (
            <span className="flex items-center gap-1">
              <Search className="h-3 w-3" /> Buscando cifra...
            </span>
          )}
          {state === "importing" && "Importando..."}
        </p>
      )}
    </div>
  );
}
