import type { DeathCause } from './shot';

export class Sound {
  private ctx: AudioContext | null = null;
  private hasAmbience = false;
  private ambientMix: GainNode | null = null;
  private ambienceDucked = false;
  private enabled = true;
  private lastFilmTick = -1;
  private nextApproachStep = 0;
  private previousPresenceVisible = true;
  private firstJerkPlayed = false;
  private fastCrossed = false;
  private runnerReturned = false;
  get isEnabled() { return this.enabled; }
  toggle() { this.enabled = !this.enabled; if (this.enabled) this.start(); else this.pause(); }
  start() {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (!this.hasAmbience) {
        this.hasAmbience = true;
        const mix = this.ctx.createGain(); mix.gain.value = .012; mix.connect(this.ctx.destination);
        this.ambientMix = mix;
        for (const [freq, volume] of [[54,.62],[107,.19],[32,.26]]) {
          const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
          osc.type = freq === 32 ? 'triangle' : 'sine';
          osc.frequency.value = freq; gain.gain.value = volume;
          osc.connect(gain); gain.connect(mix); osc.start();
        }
      }
    } catch { this.ctx = null; }
  }
  pause() { if (this.ctx) void this.ctx.suspend(); }
  restoreRoomTone() { this.holdBreath(false); }
  private holdBreath(silent: boolean) {
    if (silent === this.ambienceDucked || !this.ctx || !this.ambientMix) return;
    this.ambienceDucked = silent;
    this.ambientMix.gain.setTargetAtTime(silent ? .0003 : .012, this.ctx.currentTime, silent ? .018 : .11);
  }
  disturbance(act: number) {
    if (act === 0) { this.noise(.19,.008); this.tone(132,.18,.008,'triangle',107); }
    else if (act === 1) { this.fastPass(); }
    else { this.tone(53,.46,.025,'triangle',38); this.noise(.18,.008); }
  }
  paperFlip() {
    // Thin, bright, dry paper; the chair sound is deliberately much heavier.
    this.noise(.065, .012, 2600);
    this.noise(.095, .007, 1500);
  }
  chairScrape() {
    this.noise(.23, .021, 270);
    this.tone(94, .16, .02, 'triangle', 56);
  }
  private fastWhip() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, start = ctx.currentTime, duration = .19;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      const t = i / out.length;
      out[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI);
    }
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 620;
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(.85, start);
    pan.pan.linearRampToValueAtTime(-.85, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(.048, start + .045);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    src.connect(filter); filter.connect(pan); pan.connect(gain); gain.connect(ctx.destination);
    src.start(start); src.stop(start + duration);
  }
  private fastPass() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    // Three dry wood-floor knocks move from the window toward the classroom door.
    // Schedule in audio time so the rhythm does not depend on rendering FPS.
    for (const [delay, stereo] of [[0, .7], [.19, 0], [.38, -.7]]) {
      const duration = .085;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const progress = i / data.length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.8);
      }
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const volume = ctx.createGain();
      const pan = ctx.createStereoPanner();
      src.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 430;
      volume.gain.value = .095;
      pan.pan.value = stereo;
      src.connect(filter);
      filter.connect(volume);
      volume.connect(pan);
      pan.connect(ctx.destination);
      src.start(ctx.currentTime + delay);
    }
  }
  tone(hz: number, duration: number, volume: number, type: OscillatorType = 'sine', endHz?: number) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  noise(duration: number, volume: number, frequency = 840) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, len = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate), a = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.3;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  }
  expose(seconds: number, act: number, presence?: { visible: boolean; x: number }, heldBreath = false) {
    // At the exact instant the presence notices the operator, even the room
    // tone drops. The silence is tied to the actual apparition animation.
    this.holdBreath(heldBreath || (act === 0 && seconds >= .63 && seconds < .93));
    const presenceVisible = presence?.visible ?? true;
    if (act === 0 && seconds >= .62 && !this.firstJerkPlayed) {
      this.firstJerkPlayed = true;
      // The hand freezes and the head turns as the page settles.
      this.noise(.09, .030, 225);
      this.tone(112, .12, .025, 'triangle', 62);
    }
    if (act === 1) {
      if (seconds >= 1.62 && !this.runnerReturned) {
        this.runnerReturned = true;
        // It found an impossible route from the closed door to the lens.
        this.noise(.12, .055, 210);
        this.tone(92, .30, .045, 'triangle', 45);
      }
      if (!presenceVisible) this.fastCrossed = false;
      else if (!this.fastCrossed && Math.abs(presence?.x ?? 2) < .47) {
        this.fastCrossed = true;
        // The passing figure crosses the photographer's axis now.
        this.fastWhip();
        this.noise(.10, .043, 370);
        this.tone(136, .075, .024, 'triangle', 64);
      }
    }
    // Mechanical transport / approaching pressure, not a correct-time chime.
    if (act === 2 && this.previousPresenceVisible && !presenceVisible) {
      // The camera loses its subject at the same instant as the disappearance.
      this.noise(.045, .024, 480);
      this.tone(63, .12, .023, 'triangle', 36);
    } else if (act === 2 && !this.previousPresenceVisible && presenceVisible) {
      // A hard footfall, not another constant drone: something just appeared
      // much closer to the operator. It follows actual visibility, not a timer.
      this.noise(.14, .060, 205);
      this.tone(71, .18, .075, 'triangle', 31);
    }
    this.previousPresenceVisible = presenceVisible;
    // The brief missing ghost also interrupts the camera's film transport.
    if (act === 2 && (!presenceVisible || heldBreath)) return;
    const tick = Math.floor(seconds * (act === 2 ? 5 + seconds * 3 : 7));
    if (tick === this.lastFilmTick) return;
    this.lastFilmTick = tick;
    this.noise(.025, .003 + Math.min(seconds, 2) * .002);
    if (act === 2) this.approachingFootsteps(seconds);
  }
  private approachingFootsteps(age: number) {
    // Footsteps bunch together as the presence advances between desks.
    const stepTimes = [.22, .52, .79, 1.02, 1.21, 1.36, 1.49];
    while (this.nextApproachStep < stepTimes.length && age >= stepTimes[this.nextApproachStep]) {
      const index = this.nextApproachStep++;
      const closeness = index / (stepTimes.length - 1);
      this.noise(.095, .010 + closeness * .022, 220 - closeness * 80);
      this.tone(88 - closeness * 23, .11, .013 + closeness * .025, 'triangle', 38);
    }
  }
  open() {
    this.holdBreath(false);
    this.lastFilmTick = -1;
    this.nextApproachStep = 0;
    this.previousPresenceVisible = true;
    this.firstJerkPlayed = false;
    this.fastCrossed = false;
    this.runnerReturned = false;
    this.tone(245, .11, .025, 'sawtooth', 410);
    this.noise(.08, .026);
  }
  close() { this.holdBreath(false); this.noise(.065, .11); this.tone(190, .08, .13, 'triangle', 47); this.tone(1320, .035, .065, 'square', 520); }
  recognized() {
    // A short stop in the film transport, then a single dry click.
    this.noise(.035, .032, 620);
    this.tone(95, .08, .024, 'triangle', 58);
  }
  warning() {
    this.tone(280, .14, .035, 'triangle', 95);
    this.noise(.045, .025, 1200);
  }
  detected() { this.tone(430, .24, .036, 'sine', 650); this.tone(880, .24, .024, 'sine', 1000); }
  miss() { this.tone(162, .24, .035, 'triangle', 94); }
  death(cause: DeathCause) {
    this.holdBreath(false);
    if (cause === 'RUN_THROUGH') {
      // Body and camera collide: a short wooden crack, not a film alarm.
      this.noise(.23, .20, 165);
      this.tone(58, .25, .14, 'triangle', 26);
    }
    this.noise(.68, .18);
    this.tone(70, .83, .15, 'sawtooth', 24);
    this.tone(830, .14, .055, 'square', 75);
  }
  cue() { this.tone(960, .08, .011, 'sine', 530); }
}