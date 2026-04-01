/**
 * Multi-track audio engine using Web Audio API with pitch shifting and noise gate.
 * Uses Tone.js PitchShift for semitone transposition without tempo change.
 */
import * as Tone from "tone";

export type StemType = "vocals" | "percussion" | "harmony" | "guitar" | "backing_vocal";

interface StemChannel {
  player: Tone.Player;
  gain: Tone.Gain;
  pitchShift: Tone.PitchShift;
  /** Gate gain node – sits between pitchShift and user gain */
  gateGain: Tone.Gain;
  /** Analyser for RMS measurement */
  analyser: Tone.Analyser;
  /** Whether the noise gate is active for this stem */
  gateEnabled: boolean;
}

/** Noise gate configuration */
const GATE_THRESHOLD_DB = -40; // dB below which we close the gate
const GATE_ATTACK = 0.05; // seconds – open fast
const GATE_RELEASE = 0.1; // seconds – close smoothly

export class MultitrackEngine {
  private channels: Map<StemType, StemChannel> = new Map();
  private masterGain: Tone.Gain;
  private _isPlaying = false;
  private _currentTime = 0;
  private _duration = 0;
  private _pitch = 0;
  private animFrameId: number | null = null;
  private gateFrameId: number | null = null;
  private onTimeUpdate?: (time: number, duration: number) => void;
  private onPlayStateChange?: (playing: boolean) => void;
  private onLoadStateChange?: (loading: boolean) => void;

  constructor() {
    this.masterGain = new Tone.Gain(0.8).toDestination();
  }

  setCallbacks(cbs: {
    onTimeUpdate?: (time: number, duration: number) => void;
    onPlayStateChange?: (playing: boolean) => void;
    onLoadStateChange?: (loading: boolean) => void;
  }) {
    this.onTimeUpdate = cbs.onTimeUpdate;
    this.onPlayStateChange = cbs.onPlayStateChange;
    this.onLoadStateChange = cbs.onLoadStateChange;
  }

  async loadStem(type: StemType, url: string) {
    this.disposeChannel(type);
    this.onLoadStateChange?.(true);

    try {
      const player = new Tone.Player(url);
      const pitchShift = new Tone.PitchShift({ pitch: this._pitch });
      const analyser = new Tone.Analyser("waveform", 256);
      const gateGain = new Tone.Gain(1);
      const gain = new Tone.Gain(1);

      // Routing: player → pitchShift → analyser → gateGain → gain → master
      player.connect(pitchShift);
      pitchShift.connect(analyser);
      pitchShift.connect(gateGain);
      gateGain.connect(gain);
      gain.connect(this.masterGain);

      await Tone.loaded();

      const channel: StemChannel = {
        player, gain, pitchShift, gateGain, analyser,
        gateEnabled: false,
      };
      this.channels.set(type, channel);
      this.updateDuration();
    } finally {
      this.onLoadStateChange?.(false);
    }
  }

  private updateDuration() {
    let maxDuration = 0;
    this.channels.forEach((ch) => {
      if (ch.player.buffer.loaded) {
        maxDuration = Math.max(maxDuration, ch.player.buffer.duration);
      }
    });
    this._duration = maxDuration;
  }

  private disposeChannel(type: StemType) {
    const existing = this.channels.get(type);
    if (existing) {
      existing.player.stop();
      existing.player.dispose();
      existing.pitchShift.dispose();
      existing.analyser.dispose();
      existing.gateGain.dispose();
      existing.gain.dispose();
      this.channels.delete(type);
    }
  }

  async play() {
    if (this.channels.size === 0) return;
    await Tone.start();

    this.channels.forEach((ch) => {
      if (ch.player.buffer.loaded) {
        ch.player.start(undefined, this._currentTime);
      }
    });

    this._isPlaying = true;
    this.onPlayStateChange?.(true);
    this.startTimeTracking();
    this.startGateProcessing();
  }

  pause() {
    this.channels.forEach((ch) => {
      if (ch.player.state === "started") {
        ch.player.stop();
      }
    });
    this._isPlaying = false;
    this.onPlayStateChange?.(false);
    this.stopTimeTracking();
    this.stopGateProcessing();
  }

  stop() {
    this.pause();
    this._currentTime = 0;
    this.onTimeUpdate?.(0, this._duration);
  }

  seek(time: number) {
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this.pause();
    this._currentTime = Math.max(0, Math.min(time, this._duration));
    this.onTimeUpdate?.(this._currentTime, this._duration);
    if (wasPlaying) this.play();
  }

  setStemVolume(type: StemType, volume: number) {
    const ch = this.channels.get(type);
    if (ch) {
      ch.gain.gain.value = volume;
    }
  }

  setMasterVolume(volume: number) {
    this.masterGain.gain.value = volume;
  }

  setPitch(semitones: number) {
    this._pitch = semitones;
    this.channels.forEach((ch) => {
      ch.pitchShift.pitch = semitones;
    });
  }

  /** Enable or disable the noise gate for a specific stem */
  setGateEnabled(type: StemType, enabled: boolean) {
    const ch = this.channels.get(type);
    if (ch) {
      ch.gateEnabled = enabled;
      if (!enabled) {
        // Restore full gain immediately when disabling
        ch.gateGain.gain.cancelScheduledValues(Tone.now());
        ch.gateGain.gain.setValueAtTime(1, Tone.now());
      }
    }
  }

  isGateEnabled(type: StemType): boolean {
    return this.channels.get(type)?.gateEnabled ?? false;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  get duration() {
    return this._duration;
  }

  get currentTime() {
    return this._currentTime;
  }

  get loadedStems(): StemType[] {
    return Array.from(this.channels.keys());
  }

  // ── Noise Gate Processing ──────────────────────────────────

  private startGateProcessing() {
    const processGate = () => {
      if (!this._isPlaying) return;

      this.channels.forEach((ch) => {
        if (!ch.gateEnabled) return;

        // Read waveform from analyser
        const waveform = ch.analyser.getValue() as Float32Array;
        if (!waveform || waveform.length === 0) return;

        // Calculate RMS
        let sumSq = 0;
        for (let i = 0; i < waveform.length; i++) {
          sumSq += waveform[i] * waveform[i];
        }
        const rms = Math.sqrt(sumSq / waveform.length);
        const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;

        const now = Tone.now();
        if (rmsDb >= GATE_THRESHOLD_DB) {
          // Signal above threshold → open gate (attack)
          ch.gateGain.gain.setTargetAtTime(1, now, GATE_ATTACK);
        } else {
          // Signal below threshold → close gate (release)
          ch.gateGain.gain.setTargetAtTime(0, now, GATE_RELEASE);
        }
      });

      this.gateFrameId = requestAnimationFrame(processGate);
    };

    this.gateFrameId = requestAnimationFrame(processGate);
  }

  private stopGateProcessing() {
    if (this.gateFrameId !== null) {
      cancelAnimationFrame(this.gateFrameId);
      this.gateFrameId = null;
    }
  }

  // ── Time Tracking ──────────────────────────────────────────

  private startTimeTracking() {
    const startWall = Tone.now();
    const startOffset = this._currentTime;

    const tick = () => {
      if (!this._isPlaying) return;
      this._currentTime = startOffset + (Tone.now() - startWall);
      if (this._currentTime >= this._duration) {
        this.stop();
        return;
      }
      this.onTimeUpdate?.(this._currentTime, this._duration);
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopTimeTracking() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  dispose() {
    this.stop();
    this.channels.forEach((_, type) => this.disposeChannel(type));
    this.masterGain.dispose();
  }
}
