// SOUND — synthesised, no asset files.
//
// A wingbeat is the one sound this game cannot do without: it is the bee's
// voice, it is continuous, and it is the cheapest possible confirmation that
// you are moving. Everything here is WebAudio oscillators and noise bursts, so
// it costs nothing to load and can be retuned by changing numbers.
//
// Browsers refuse to start audio without a gesture, so the context is created
// lazily on the first click — which is the same click that grabs pointer lock.

type Ctx = AudioContext & { _bhtStarted?: boolean };

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private wingGain: GainNode | null = null;
  private wingOsc: OscillatorNode | null = null;
  private wingSub: OscillatorNode | null = null;
  private wingFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  enabled = true;

  /** Call from a real user gesture. Safe to call repeatedly. */
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC() as Ctx;
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // Noise, reused by every one-shot.
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // --- the wingbeat ---
    // Two detuned saws through a lowpass. A bee's wingbeat is ~230 Hz, and
    // the buzz you recognise is the beating between the two, not either tone.
    this.wingFilter = ctx.createBiquadFilter();
    this.wingFilter.type = 'lowpass';
    this.wingFilter.frequency.value = 900;
    this.wingFilter.Q.value = 3;

    this.wingGain = ctx.createGain();
    this.wingGain.gain.value = 0;

    this.wingOsc = ctx.createOscillator();
    this.wingOsc.type = 'sawtooth';
    this.wingOsc.frequency.value = 230;
    this.wingSub = ctx.createOscillator();
    this.wingSub.type = 'sawtooth';
    this.wingSub.frequency.value = 236; // the beat frequency IS the buzz

    this.wingOsc.connect(this.wingFilter);
    this.wingSub.connect(this.wingFilter);
    this.wingFilter.connect(this.wingGain);
    this.wingGain.connect(this.master);
    this.wingOsc.start();
    this.wingSub.start();
  }

  setMasterVolume(v: number) {
    if (this.master) this.master.gain.value = v;
  }

  /**
   * `speed01` is 0..1 of top speed, `boost` whether overdrive is held.
   * Pitch and brightness both climb, which is what makes effort audible.
   */
  wing(speed01: number, boost: boolean) {
    if (!this.ctx || !this.wingOsc || !this.wingSub || !this.wingGain || !this.wingFilter) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, Math.max(0, speed01));
    const base = 195 + s * 105 + (boost ? 55 : 0);
    // setTargetAtTime rather than setValueAtTime: the pitch slides instead of
    // stepping, which is the difference between a bee and a modem.
    this.wingOsc.frequency.setTargetAtTime(base, t, 0.05);
    this.wingSub.frequency.setTargetAtTime(base * 1.026, t, 0.05);
    this.wingFilter.frequency.setTargetAtTime(700 + s * 2400 + (boost ? 900 : 0), t, 0.06);
    const target = this.enabled ? 0.05 + s * 0.085 + (boost ? 0.05 : 0) : 0;
    this.wingGain.gain.setTargetAtTime(target, t, 0.08);
  }

  /** Filtered noise burst — the basis of every impact in the game. */
  private burst(o: {
    freq: number; q: number; gain: number; decay: number;
    type?: BiquadFilterType; sweepTo?: number;
  }) {
    if (!this.ctx || !this.noiseBuffer || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq, t);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.decay);
    f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.decay);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + o.decay + 0.02);
  }

  private tone(freq: number, to: number, gain: number, decay: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  grappleFire() { this.burst({ freq: 2600, q: 1.4, gain: 0.18, decay: 0.09, sweepTo: 700 }); }
  grappleHit() { this.burst({ freq: 320, q: 2.2, gain: 0.3, decay: 0.16 }); this.tone(180, 90, 0.12, 0.14); }
  sting() { this.tone(880, 240, 0.2, 0.14, 'square'); this.burst({ freq: 3000, q: 1, gain: 0.14, decay: 0.07 }); }
  hitProp() { this.burst({ freq: 900, q: 1.6, gain: 0.16, decay: 0.08 }); }
  swatWhoosh() { this.burst({ freq: 260, q: 0.7, gain: 0.34, decay: 0.34, sweepTo: 90 }); }
  zap() { this.burst({ freq: 5200, q: 0.6, gain: 0.3, decay: 0.22, sweepTo: 400 }); }
  deposit() { this.tone(520, 880, 0.16, 0.2, 'triangle'); }
  unlock() { this.tone(440, 660, 0.14, 0.35, 'triangle'); this.tone(660, 990, 0.1, 0.45, 'triangle'); }
  hack() { this.tone(220, 460, 0.12, 0.18, 'square'); }
}
