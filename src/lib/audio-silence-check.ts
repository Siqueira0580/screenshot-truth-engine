/**
 * Gatekeeper: detects silent audio blobs before sending to AI transcription.
 * Returns true if audio contains meaningful sound, false if silent.
 */
export async function checkAudioVolume(
  audioBlob: Blob,
  threshold = 0.01,
): Promise<boolean> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 44100, 44100);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    let peakAmplitude = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > peakAmplitude) peakAmplitude = abs;
      }
    }

    console.log(`[audio-silence-check] Peak amplitude: ${peakAmplitude.toFixed(4)}, threshold: ${threshold}`);
    return peakAmplitude >= threshold;
  } catch (err) {
    console.warn("[audio-silence-check] Could not decode audio, allowing through:", err);
    // If we can't decode, let the AI handle it rather than blocking
    return true;
  }
}

/**
 * Known hallucination phrases that AI models produce on silent/empty audio.
 * If the transcription is ONLY one of these, it should be treated as empty.
 */
const HALLUCINATION_PHRASES = [
  "obrigado",
  "obrigada",
  "obrigado.",
  "obrigada.",
  "thank you",
  "thank you.",
  "thanks",
  "thanks.",
  "subtitles by amara.org",
  "subtitles by",
  "legendas pela comunidade amara.org",
  "tchau",
  "tchau.",
  "bye",
  "bye.",
  "...",
  "you",
  "the end",
  "the end.",
  "fim",
  "fim.",
];

/**
 * Post-processing filter: strips known AI hallucination artifacts from
 * transcription results on near-silent audio.
 */
export function sanitizeTranscription(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");

  if (HALLUCINATION_PHRASES.includes(lower)) {
    console.log(`[audio-silence-check] Filtered hallucination: "${trimmed}"`);
    return "";
  }

  // Also filter very short results (≤3 words) that are likely hallucinations
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 2 && lower.length < 20) {
    console.log(`[audio-silence-check] Filtered short suspicious result: "${trimmed}"`);
    return "";
  }

  return trimmed;
}
