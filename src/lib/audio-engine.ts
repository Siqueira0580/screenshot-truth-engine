/**
 * Multi-track audio engine using Web Audio API with pitch shifting.
 * Uses Tone.js PitchShift for semitone transposition without tempo change.
 */
import * as Tone from "tone";

export type StemType = "full" | "vocals" | "percussion" | "harmony";

interface StemChannel {
  player: Tone.Player;
  gain: Tone.Gain;
  pitchShift: Tone.PitchShift;
}

export class MultitrackEngine {
  private channels: Map<StemType, StemChannel> = new Map();
  private masterGain: Tone.Gain;
  private _isPlaying = false;
  private _currentTime = 0;
  private _duration = 0;
  private _pitch = 0;
  private animFrameId: number | null = null;
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
    // Dispose existing channel
    this.disposeChannel(type);

    this.onLoadStateChange?.(true);

    try {
      const player = new Tone.Player(url);
      const pitchShift = new Tone.PitchShift({ pitch: this._pitch });
      const gain = new Tone.Gain(1);

      player.connect(pitchShift);
      pitchShift.connect(gain);
      gain.connect(this.masterGain);

      // Wait for buffer to load
      await Tone.loaded();

      const channel: StemChannel = { player, gain, pitchShift };
      this.channels.set(type, channel);

      // Update duration from longest stem
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
      existing.gain.dispose();
      this.channels.delete(type);
    }
  }

  async play() {
    if (this.channels.size === 0) return;
    await Tone.start();

    // Sync all players
    this.channels.forEach((ch) => {
      if (ch.player.buffer.loaded) {
        ch.player.start(undefined, this._currentTime);
      }
    });

    this._isPlaying = true;
    this.onPlayStateChange?.(true);
    this.startTimeTracking();
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
