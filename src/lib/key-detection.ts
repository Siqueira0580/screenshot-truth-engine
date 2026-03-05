/**
 * Audio Analysis: Key Detection (Krumhansl-Schmuckler) + BPM Detection (autocorrelation)
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

export interface AudioAnalysisResult {
  key: KeyDetectionResult;
  bpm: number;
  bpmConfidence: number;
}

/**
 * BPM detection using onset detection + autocorrelation
 */
async function detectBpmFromBuffer(audioUrl: string): Promise<{ bpm: number; confidence: number }> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

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

  // Compute onset strength envelope (energy in short frames)
  const frameSize = Math.round(sampleRate * 0.01); // 10ms frames
  const hopFrames = Math.round(sampleRate * 0.005); // 5ms hop
  const numFrames = Math.floor((length - frameSize) / hopFrames);
  const energy = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopFrames;
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      sum += mono[start + j] * mono[start + j];
    }
    energy[i] = sum / frameSize;
  }

  // Compute onset detection function (first-order difference, half-wave rectified)
  const onset = new Float32Array(numFrames);
  for (let i = 1; i < numFrames; i++) {
    const diff = energy[i] - energy[i - 1];
    onset[i] = diff > 0 ? diff : 0;
  }

  // Autocorrelation of onset function for BPM range 50-200
  const framesPerSecond = sampleRate / hopFrames;
  const minLag = Math.round(framesPerSecond * (60 / 200)); // 200 BPM
  const maxLag = Math.round(framesPerSecond * (60 / 50));  // 50 BPM
  const analysisLength = Math.min(onset.length, Math.round(framesPerSecond * 30)); // analyze 30s max

  let bestLag = minLag;
  let bestCorr = -Infinity;
  let secondBestCorr = -Infinity;
  const correlations = new Float32Array(maxLag - minLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < analysisLength - lag; i++) {
      corr += onset[i] * onset[i + lag];
      count++;
    }
    corr = count > 0 ? corr / count : 0;
    correlations[lag - minLag] = corr;

    if (corr > bestCorr) {
      secondBestCorr = bestCorr;
      bestCorr = corr;
      bestLag = lag;
    } else if (corr > secondBestCorr) {
      secondBestCorr = corr;
    }
  }

  // Also check double-time and half-time
  const rawBpm = (framesPerSecond * 60) / bestLag;
  let bpm = Math.round(rawBpm);

  // Normalize BPM to common range (70-180)
  if (bpm < 70) bpm *= 2;
  if (bpm > 180) bpm = Math.round(bpm / 2);

  const confidence = bestCorr > 0 ? Math.min(1, (bestCorr - secondBestCorr) / bestCorr) : 0;

  audioCtx.close();
  return { bpm, confidence };
}

export async function detectKey(audioUrl: string): Promise<KeyDetectionResult> {
  const chromagram = await buildChromagramFast(audioUrl);

  let bestKey = 0;
  let bestMode: "Major" | "Minor" = "Major";
  let bestCorr = -Infinity;
  let secondBest = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
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
 * Unified audio analysis: detects key AND BPM in one pass
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysisResult> {
  const [keyResult, bpmResult] = await Promise.all([
    detectKey(audioUrl),
    detectBpmFromBuffer(audioUrl),
  ]);

  return {
    key: keyResult,
    bpm: bpmResult.bpm,
    bpmConfidence: bpmResult.confidence,
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
