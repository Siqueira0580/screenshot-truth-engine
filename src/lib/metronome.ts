/**
 * StageMetronome — Web Audio API metronome with visual pulse callback.
 */

export type MetronomeMode = "sound+pulse" | "pulse" | "off";

export interface MetronomeOptions {
  bpm: number;
  mode: MetronomeMode;
  onPulse: (beat: number) => void;
}

export class StageMetronome {
  private audioCtx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private bpm: number;
  private mode: MetronomeMode;
  private onPulse: (beat: number) => void;
  private running = false;

  constructor(opts: MetronomeOptions) {
    this.bpm = opts.bpm;
    this.mode = opts.mode;
    this.onPulse = opts.onPulse;
  }

  get isRunning() {
    return this.running;
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  setMode(mode: MetronomeMode) {
    this.mode = mode;
  }

  start() {
    if (this.running || this.bpm <= 0 || this.mode === "off") return;
    this.running = true;
    this.beat = 0;

    if (this.mode === "sound+pulse" && !this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    const interval = 60000 / this.bpm;

    this.tick(); // first beat immediately
    this.intervalId = setInterval(() => this.tick(), interval);
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy() {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private tick() {
    this.beat++;
    const beatInBar = ((this.beat - 1) % 4) + 1;

    // visual pulse
    this.onPulse(beatInBar);

    // audio beep
    if (this.mode === "sound+pulse" && this.audioCtx) {
      this.beep(beatInBar === 1 ? 880 : 660, 0.06);
    }
  }

  private beep(freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + duration);
  }
}
