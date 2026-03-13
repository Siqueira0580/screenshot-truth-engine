import { useState, useRef, useCallback, useEffect } from "react";

/* ─── Constants ─── */
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const A4 = 440;
const LERP_FACTOR = 0.12;          // smoothing speed (lower = heavier/smoother)
const SILENCE_HOLD_MS = 800;       // hold last reading for this long after silence
const HYSTERESIS_IN = 3;           // cents threshold to enter "in tune"
const HYSTERESIS_OUT = 6;          // cents threshold to leave "in tune"

export interface TunerResult {
  note: string;
  frequency: number;
  cents: number;       // -50 to +50
  octave: number;
  isInTune: boolean;   // hysteresis-aware state
}

/* ─── Hz → Note + Cents ─── */
function hzToNoteData(frequency: number) {
  if (frequency < 20 || frequency > 5000) return null;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = (semitonesFromA4 - roundedSemitones) * 100;
  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
  return { note: NOTE_NAMES[noteIndex], frequency, cents, octave };
}

/* ─── Autocorrelation Pitch Detection ─── */
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return null;

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  let lastCorrelation = 1;

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;

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
export function useTuner() {
  const [isActive, setIsActive] = useState(false);
  const [tunerData, setTunerData] = useState<TunerResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  // Smoothing refs (mutable, not in React state to avoid re-renders per frame)
  const smoothCentsRef = useRef(0);
  const smoothHzRef = useRef(0);
  const isInTuneRef = useRef(false);
  const lastSignalTimeRef = useRef(0);
  const lastNoteRef = useRef<string>("A");
  const lastOctaveRef = useRef<number>(4);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsActive(false);
    setTunerData(null);
    smoothCentsRef.current = 0;
    smoothHzRef.current = 0;
    isInTuneRef.current = false;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const loop = () => {
        analyser.getFloatTimeDomainData(buffer);
        const hz = detectPitch(buffer, audioCtx.sampleRate);
        const now = performance.now();

        if (hz) {
          const raw = hzToNoteData(hz);
          if (raw) {
            lastSignalTimeRef.current = now;
            lastNoteRef.current = raw.note;
            lastOctaveRef.current = raw.octave;

            // Lerp smoothing
            smoothHzRef.current += (raw.frequency - smoothHzRef.current) * LERP_FACTOR;
            smoothCentsRef.current += (raw.cents - smoothCentsRef.current) * LERP_FACTOR;

            // Hysteresis for in-tune state
            const absCents = Math.abs(smoothCentsRef.current);
            if (isInTuneRef.current) {
              if (absCents > HYSTERESIS_OUT) isInTuneRef.current = false;
            } else {
              if (absCents <= HYSTERESIS_IN) isInTuneRef.current = true;
            }

            setTunerData({
              note: raw.note,
              frequency: Math.round(smoothHzRef.current * 10) / 10,
              cents: Math.round(smoothCentsRef.current),
              octave: raw.octave,
              isInTune: isInTuneRef.current,
            });
          }
        } else {
          // Silence / noise gate: hold last reading, then fade
          const elapsed = now - lastSignalTimeRef.current;
          if (elapsed > SILENCE_HOLD_MS) {
            setTunerData(null);
          }
          // else: keep showing last stable reading (do nothing)
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
      setIsActive(true);
    } catch {
      console.error("Mic access denied for tuner");
    }
  }, []);

  const toggle = useCallback(() => {
    if (isActive) stop();
    else start();
  }, [isActive, start, stop]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { isActive, tunerData, start, stop, toggle };
}
