import { useState, useRef, useCallback, useEffect } from "react";

/* ─── Instrument Presets ─── */
export interface StringPreset {
  note: string;
  hz: number;
}

export interface InstrumentPreset {
  label: string;
  strings: StringPreset[];
}

/* ─── Chromatic Scale (C2–B5) ─── */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function buildChromaticScale(): StringPreset[] {
  const notes: StringPreset[] = [];
  for (let octave = 2; octave <= 5; octave++) {
    for (let i = 0; i < 12; i++) {
      const name = `${NOTE_NAMES[i]}${octave}`;
      const midi = (octave + 1) * 12 + i; // C2 = midi 36
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      notes.push({ note: name, hz: Math.round(hz * 100) / 100 });
    }
  }
  return notes;
}

export const CHROMATIC_SCALE = buildChromaticScale();

export function findClosestNote(hz: number): StringPreset {
  let closest = CHROMATIC_SCALE[0];
  let minDist = Infinity;
  for (const n of CHROMATIC_SCALE) {
    const dist = Math.abs(1200 * Math.log2(hz / n.hz));
    if (dist < minDist) { minDist = dist; closest = n; }
  }
  return closest;
}

export const INSTRUMENT_PRESETS: Record<string, InstrumentPreset> = {
  chromatic: {
    label: "Cromático",
    strings: [], // empty = auto-detect mode
  },
  guitar: {
    label: "Violão",
    strings: [
      { note: "E2", hz: 82.41 },
      { note: "A2", hz: 110.0 },
      { note: "D3", hz: 146.83 },
      { note: "G3", hz: 196.0 },
      { note: "B3", hz: 246.94 },
      { note: "E4", hz: 329.63 },
    ],
  },
  cavaquinho: {
    label: "Cavaquinho",
    strings: [
      { note: "D4", hz: 293.66 },
      { note: "G4", hz: 392.0 },
      { note: "B4", hz: 493.88 },
      { note: "D5", hz: 587.33 },
    ],
  },
  ukulele: {
    label: "Ukulele",
    strings: [
      { note: "G4", hz: 392.0 },
      { note: "C4", hz: 261.63 },
      { note: "E4", hz: 329.63 },
      { note: "A4", hz: 440.0 },
    ],
  },
};

/* ─── Constants ─── */
const LERP_FACTOR = 0.15;
const HYSTERESIS_IN = 3;
const HYSTERESIS_OUT = 6;

export interface TunerResult {
  detectedHz: number;
  cents: number;
  isInTune: boolean;
  targetString: StringPreset;
}

/* ─── Autocorrelation Pitch Detection ─── */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  // RMS gate
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.006) return -1;

  // Trim silence from edges for better correlation
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < MAX_SAMPLES; i++) {
    if (Math.abs(buf[i]) < threshold) r1 = i; else break;
  }
  for (let i = 1; i < MAX_SAMPLES; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) r2 = SIZE - i; else break;
  }

  const trimmed = buf.slice(r1, r2);
  const trimmedSize = trimmed.length;

  // Autocorrelation
  const c = new Float32Array(trimmedSize);
  for (let i = 0; i < trimmedSize; i++) {
    for (let j = 0; j < trimmedSize - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find first dip then first peak
  let d = 0;
  while (c[d] > c[d + 1] && d < trimmedSize) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < trimmedSize; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  // Parabolic interpolation for sub-sample accuracy
  const y1 = c[maxPos - 1] ?? 0;
  const y2 = c[maxPos];
  const y3 = c[maxPos + 1] ?? 0;
  const shift = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  const refinedPos = maxPos + (Number.isFinite(shift) ? shift : 0);

  return sampleRate / refinedPos;
}

/* ─── Hz → Cents relative to target ─── */
function hzToCents(detected: number, target: number): number {
  return 1200 * Math.log2(detected / target);
}

/* ─── Hook ─── */
export function useTuner() {
  const [isActive, setIsActive] = useState(false);
  const [instrument, setInstrument] = useState<string>("guitar");
  const [targetIndex, setTargetIndex] = useState<number>(0);
  const [tunerData, setTunerData] = useState<TunerResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const smoothCentsRef = useRef(0);
  const smoothHzRef = useRef(0);
  const isInTuneRef = useRef(false);

  const preset = INSTRUMENT_PRESETS[instrument];
  const isChromaticMode = preset.strings.length === 0;
  const targetString = isChromaticMode ? null : (preset.strings[targetIndex] ?? preset.strings[0]);

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
        const hz = autoCorrelate(buffer, audioCtx.sampleRate);

        if (hz > 0) {
          // Find closest target string for current instrument
          const currentPreset = INSTRUMENT_PRESETS[instrument];
          const target = currentPreset?.strings[targetIndex] ?? currentPreset?.strings[0];
          if (!target) { rafRef.current = requestAnimationFrame(loop); return; }

          const rawCents = hzToCents(hz, target.hz);

          // Lerp smoothing
          smoothHzRef.current += (hz - smoothHzRef.current) * LERP_FACTOR;
          smoothCentsRef.current += (rawCents - smoothCentsRef.current) * LERP_FACTOR;

          // Hysteresis
          const absCents = Math.abs(smoothCentsRef.current);
          if (isInTuneRef.current) {
            if (absCents > HYSTERESIS_OUT) isInTuneRef.current = false;
          } else {
            if (absCents <= HYSTERESIS_IN) isInTuneRef.current = true;
          }

          setTunerData({
            detectedHz: Math.round(smoothHzRef.current * 10) / 10,
            cents: Math.round(smoothCentsRef.current),
            isInTune: isInTuneRef.current,
            targetString: target,
          });
        }
        // Silence: keep last reading (noise gate behavior)

        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
      setIsActive(true);
    } catch {
      console.error("Mic access denied for tuner");
    }
  }, [instrument, targetIndex]);

  const toggle = useCallback(() => {
    if (isActive) stop();
    else start();
  }, [isActive, start, stop]);

  // Reset target when instrument changes
  const changeInstrument = useCallback((id: string) => {
    setInstrument(id);
    setTargetIndex(0);
    smoothCentsRef.current = 0;
    smoothHzRef.current = 0;
    isInTuneRef.current = false;
    setTunerData(null);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isActive,
    tunerData,
    instrument,
    targetIndex,
    targetString,
    preset,
    start,
    stop,
    toggle,
    changeInstrument,
    setTargetIndex,
  };
}
