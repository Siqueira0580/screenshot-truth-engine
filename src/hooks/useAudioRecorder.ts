import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

/* ─── Types ─── */
export type RecordingState = "idle" | "recording" | "paused" | "recorded";

interface RecordingResult {
  audioBlob: Blob;
  audioUrl: string;
}

/* ─── Hz → Note conversion ─── */
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

function hzToNote(frequency: number): string | null {
  if (frequency < 60 || frequency > 1200) return null;
  const semitones = 12 * Math.log2(frequency / 440);
  const noteIndex = Math.round(semitones) % 12;
  return NOTE_NAMES[(noteIndex + 12 + 9) % 12];
}

/* ─── Autocorrelation pitch detection ─── */
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

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
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pitchRafRef = useRef<number>(0);
  const currentNoteRef = useRef<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(pitchRafRef.current);
      audioCtxRef.current?.close();
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

  /* ── Start a new recording ── */
  const startRecording = useCallback(async () => {
    try {
      // Revoke previous audioUrl
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      audioBlobRef.current = null;

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

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        // Stop mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        // Stop pitch detection
        cancelAnimationFrame(pitchRafRef.current);
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;

        const url = URL.createObjectURL(blob);
        audioBlobRef.current = blob;
        setAudioUrl(url);
        setCurrentNote(null);
        setRecordingState("recorded");
        toast.success("Gravação concluída!");
      };

      // timeslice = 250ms so we get chunks periodically
      recorder.start(250);

      // Start pitch detection
      startPitchDetection(stream);

      setRecordingState("recording");
    } catch (err) {
      console.error("Mic access error:", err);
      toast.error("Não foi possível aceder ao microfone. Verifique as permissões.");
    }
  }, [audioUrl, startPitchDetection]);

  /* ── Pause recording ── */
  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setRecordingState("paused");
    }
  }, []);

  /* ── Resume recording ── */
  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setRecordingState("recording");
    }
  }, []);

  /* ── Stop recording (finalize) ── */
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // triggers onstop → sets state to "recorded"
    }
  }, []);

  /* ── Get the final result ── */
  const getResult = useCallback((): RecordingResult | null => {
    if (!audioBlobRef.current || !audioUrl) return null;
    return { audioBlob: audioBlobRef.current, audioUrl };
  }, [audioUrl]);

  return {
    recordingState,
    audioUrl,
    currentNote,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    getResult,
  };
}
