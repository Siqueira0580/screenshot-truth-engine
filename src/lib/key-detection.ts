/**
 * Audio Key Detection using Krumhansl-Schmuckler algorithm
 * Analyzes audio frequency content to determine the musical key
 */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(chromagram: number[], profile: number[]): number {
  const n = chromagram.length;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += chromagram[i]; sumY += profile[i]; }
  const meanX = sumX / n, meanY = sumY / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = chromagram[i] - meanX;
    const dy = profile[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}



// Faster chromagram using Web Audio API AnalyserNode
async function buildChromagramFast(audioUrl: string): Promise<number[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  const chroma = new Float64Array(12);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Mix to mono
  const mono = new Float32Array(length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  // Use OfflineAudioContext with AnalyserNode
  const fftSize = 8192;
  const hopSize = fftSize / 2;
  const numFrames = Math.min(Math.floor((length - fftSize) / hopSize), 150);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    const segment = mono.slice(start, start + fftSize);

    // Hann window
    for (let i = 0; i < segment.length; i++) {
      segment[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segment.length - 1)));
    }

    // Simple magnitude estimation per pitch class using goertzel-like approach
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      // Check multiple octaves for this pitch class (octaves 2-6)
      for (let octave = 2; octave <= 6; octave++) {
        const midiNote = pitchClass + octave * 12;
        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
        const binIndex = Math.round((freq * fftSize) / sampleRate);
        if (binIndex >= fftSize / 2) continue;

        // Goertzel algorithm for targeted frequency
        const k = binIndex;
        const w = (2 * Math.PI * k) / fftSize;
        const coeff = 2 * Math.cos(w);
        let s0 = 0, s1 = 0, s2 = 0;
        for (let i = 0; i < segment.length; i++) {
          s0 = segment[i] + coeff * s1 - s2;
          s2 = s1;
          s1 = s0;
        }
        const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
        chroma[pitchClass] += Math.abs(power);
      }
    }
  }

  audioCtx.close();
  return Array.from(chroma);
}

export interface KeyDetectionResult {
  key: string;        // e.g. "C", "F#"
  mode: "Major" | "Minor";
  confidence: number; // 0-1
  display: string;    // e.g. "C Major"
}

export async function detectKey(audioUrl: string): Promise<KeyDetectionResult> {
  const chromagram = await buildChromagramFast(audioUrl);

  let bestKey = 0;
  let bestMode: "Major" | "Minor" = "Major";
  let bestCorr = -Infinity;
  let secondBest = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    // Rotate chromagram
    const rotated = [...chromagram.slice(shift), ...chromagram.slice(0, shift)];

    const majorCorr = correlate(rotated, MAJOR_PROFILE);
    const minorCorr = correlate(rotated, MINOR_PROFILE);

    if (majorCorr > bestCorr) {
      secondBest = bestCorr;
      bestCorr = majorCorr;
      bestKey = shift;
      bestMode = "Major";
    } else if (majorCorr > secondBest) {
      secondBest = majorCorr;
    }

    if (minorCorr > bestCorr) {
      secondBest = bestCorr;
      bestCorr = minorCorr;
      bestKey = shift;
      bestMode = "Minor";
    } else if (minorCorr > secondBest) {
      secondBest = minorCorr;
    }
  }

  // Confidence: gap between best and second best correlation
  const confidence = Math.max(0, Math.min(1, (bestCorr - secondBest) / 0.5));

  const noteName = NOTE_NAMES[bestKey];
  const modeLabel = bestMode === "Major" ? "Maior" : "Menor";

  return {
    key: noteName,
    mode: bestMode,
    confidence,
    display: `${noteName} ${modeLabel}`,
  };
}

/**
 * Get the transposed key name given an original key and semitone shift
 */
export function getTransposedKey(originalKey: string, semitones: number): string {
  const idx = NOTE_NAMES.indexOf(originalKey);
  if (idx === -1) return originalKey;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return NOTE_NAMES[newIdx];
}
