import { useState, useRef, useCallback } from "react";

type VoiceStatus = "idle" | "listening";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const isVoiceSupported = !!SpeechRecognitionAPI;

export function useVoiceSearch(onResult: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const recRef = useRef<any>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    stop();

    const rec = new SpeechRecognitionAPI();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setStatus("listening");

    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onResult(text);
    };

    rec.onerror = () => setStatus("idle");
    rec.onend = () => setStatus("idle");

    recRef.current = rec;
    rec.start();
  }, [onResult, stop]);

  const toggle = useCallback(() => {
    if (status === "listening") stop();
    else start();
  }, [status, start, stop]);

  return { status, toggle, isListening: status === "listening" };
}
