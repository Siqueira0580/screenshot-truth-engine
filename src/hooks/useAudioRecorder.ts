import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RecordingResult {
  chordProText: string;
  detectedKey: string;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      toast.error("Não foi possível aceder ao microfone. Verifique as permissões.");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        // Stop all mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        resolve(blob);
      };

      recorder.stop();
      setIsRecording(false);
    });
  }, []);

  /**
   * Process the recorded audio blob with AI.
   * Currently uses a simulated response.
   * When ready, replace with real edge function call sending audio + style.
   */
  const processAudioWithAI = useCallback(
    async (audioBlob: Blob, selectedStyle: string): Promise<RecordingResult> => {
      setIsProcessing(true);

      try {
        // ── Preparação do payload (estrutura pronta para a Edge Function real) ──
        // const reader = new FileReader();
        // const base64Audio = await new Promise<string>((res) => {
        //   reader.onloadend = () => res((reader.result as string).split(",")[1]);
        //   reader.readAsDataURL(audioBlob);
        // });
        //
        // Payload futuro para a IA:
        // {
        //   audio_base64: base64Audio,
        //   style: selectedStyle,
        //   instruction: `Transcreva este áudio e aplique uma harmonização preditiva
        //                 no estilo ${selectedStyle}. Devolva em formato ChordPro e informe o Tom.`
        // }

        // ── Simulação (3s) — substituir por chamada real quando a Edge Function estiver pronta ──
        await new Promise((r) => setTimeout(r, 3000));

        const mockResponses: Record<string, RecordingResult> = {
          "Bossa Nova": {
            chordProText:
              "[Am7]Hoje eu a[Dm7]cordei pen[G7]sando\n[C7M]Que a vida [F7M]é feita de [Bm7(b5)]mo[E7]mentos",
            detectedKey: "Am",
          },
          Pop: {
            chordProText:
              "[C]Sinto o sol [G]brilhar em [Am]mim\n[F]Cada dia é [C]um novo [G]fim",
            detectedKey: "C",
          },
          Rock: {
            chordProText:
              "[Em]Grito ao [D]vento que [C]passa\n[G]A força [D]vem de [Em]dentro",
            detectedKey: "Em",
          },
          Worship: {
            chordProText:
              "[G]Tua graça [D]me sus[Em]tenta\n[C]Tua luz me [G]guia [D]sempre",
            detectedKey: "G",
          },
        };

        const result = mockResponses[selectedStyle] || {
          chordProText:
            "[Am7]Hoje eu a[Dm7]cordei pen[G7]sando\n[C7M]Que a vida [F7M]é feita de [Bm7(b5)]mo[E7]mentos",
          detectedKey: "Am",
        };

        toast.success("Harmonia deduzida com sucesso!");
        return result;
      } catch (err) {
        console.error("AI processing error:", err);
        toast.error("Erro ao processar áudio com IA.");
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const toggleRecording = useCallback(
    async (
      selectedStyle: string,
      onResult: (result: RecordingResult) => void,
    ) => {
      if (isRecording) {
        const blob = await stopRecording();
        if (blob && blob.size > 0) {
          const result = await processAudioWithAI(blob, selectedStyle);
          onResult(result);
        }
      } else {
        await startRecording();
      }
    },
    [isRecording, startRecording, stopRecording, processAudioWithAI],
  );

  return { isRecording, isProcessing, toggleRecording };
}
