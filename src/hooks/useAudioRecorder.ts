import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

/* ─── Types ─── */
interface ChordProToken {
  chord: string | null;
  lyric: string;
}

interface RecordingResult {
  chordProText: string;
  detectedKey: string;
  audioUrl: string | null;
}

/* ─── Hz → Note conversion ─── */
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

function hzToNote(frequency: number): string | null {
  if (frequency < 60 || frequency > 1200) return null; // outside useful vocal range
  const semitones = 12 * Math.log2(frequency / 440);
  const noteIndex = Math.round(semitones) % 12;
  return NOTE_NAMES[(noteIndex + 12 + 9) % 12]; // A=440 is index 9
}

/* ─── Autocorrelation pitch detection ─── */
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  // Simple autocorrelation
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  // RMS check — if signal is too quiet, skip
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  let lastCorrelation = 1;
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      // We've found a good correlation, then it got worse — use the best
      break;
    }
    lastCorrelation = correlation;
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    return sampleRate / bestOffset;
  }
  return null;
}

/* ─── Hook ─── */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chordProText, setChordProText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pitchRafRef = useRef<number>(0);
  const currentNoteRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const tokensRef = useRef<ChordProToken[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(pitchRafRef.current);
      audioCtxRef.current?.close();
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Pitch detection loop ── */
  const startPitchDetection = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buffer = new Float32Array(analyser.fftSize);

    const loop = () => {
      analyser.getFloatTimeDomainData(buffer);
      const hz = detectPitch(buffer, audioCtx.sampleRate);
      const note = hz ? hzToNote(hz) : null;

      if (note && note !== currentNoteRef.current) {
        currentNoteRef.current = note;
        setCurrentNote(note);
      }

      pitchRafRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, []);

  /* ── Speech Recognition setup ── */
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.warning("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult.isFinal) return;

      const transcript = lastResult[0].transcript.trim();
      if (!transcript) return;

      // Grab the note that was active when the words were spoken
      const activeNote = currentNoteRef.current;

      // Split transcript into words and assign the current chord to the first word
      const words = transcript.split(/\s+/);
      words.forEach((word, idx) => {
        const token: ChordProToken = {
          chord: idx === 0 ? activeNote : null,
          lyric: word + " ",
        };
        tokensRef.current.push(token);
      });

      // Build ChordPro string from tokens
      const cpText = tokensRef.current
        .map((t) => (t.chord ? `[${t.chord}]${t.lyric}` : t.lyric))
        .join("");
      setChordProText(cpText);
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is common and not a real error
      if (event.error !== "no-speech") {
        console.warn("SpeechRecognition error:", event.error);
      }
    };

    // Auto-restart if it stops while still recording
    recognition.onend = () => {
      if (streamRef.current) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  /* ── Start recording ── */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Reset state
      tokensRef.current = [];
      currentNoteRef.current = null;
      setChordProText("");
      setCurrentNote(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      // 1) MediaRecorder for saving the audio blob
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);

      // 2) Web Audio API pitch detection
      startPitchDetection(stream);

      // 3) SpeechRecognition for lyrics
      startSpeechRecognition();

      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      toast.error("Não foi possível aceder ao microfone. Verifique as permissões.");
    }
  }, [audioUrl, startPitchDetection, startSpeechRecognition]);

  /* ── Stop recording ── */
  const stopRecording = useCallback((): Promise<RecordingResult> => {
    return new Promise((resolve) => {
      setIsProcessing(true);

      // Stop speech recognition
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;

      // Stop pitch detection
      cancelAnimationFrame(pitchRafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        setIsProcessing(false);
        resolve({
          chordProText: tokensRef.current
            .map((t) => (t.chord ? `[${t.chord}]${t.lyric}` : t.lyric))
            .join(""),
          detectedKey: currentNoteRef.current || "C",
          audioUrl: null,
        });
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        // Stop mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        // Create playback URL
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Detect key from most frequent note
        const noteCounts: Record<string, number> = {};
        tokensRef.current.forEach((t) => {
          if (t.chord) noteCounts[t.chord] = (noteCounts[t.chord] || 0) + 1;
        });
        const detectedKey =
          Object.entries(noteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          currentNoteRef.current ||
          "C";

        const finalText = tokensRef.current
          .map((t) => (t.chord ? `[${t.chord}]${t.lyric}` : t.lyric))
          .join("");

        setIsRecording(false);
        setIsProcessing(false);
        setCurrentNote(null);

        toast.success("Gravação concluída! Cifra gerada em tempo real.");

        resolve({ chordProText: finalText, detectedKey, audioUrl: url });
      };

      recorder.stop();
    });
  }, []);

  /* ── Toggle (convenience) ── */
  const toggleRecording = useCallback(
    async (
      _style: string,
      onResult: (result: RecordingResult) => void,
    ) => {
      if (isRecording) {
        const result = await stopRecording();
        onResult(result);
      } else {
        await startRecording();
      }
    },
    [isRecording, startRecording, stopRecording],
  );

  return {
    isRecording,
    isProcessing,
    chordProText,
    audioUrl,
    currentNote,
    toggleRecording,
  };
}
