export class Sound {
  private ctx: AudioContext | null = null;
  private hasAmbience = false;
  private enabled = true;
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
  disturbance(act: number) {
    if (act === 0) { this.noise(.19,.008); this.tone(132,.18,.008,'triangle',107); }
    else if (act === 1) { this.tone(900,.07,.014,'sine',240); this.noise(.12,.011); }
    else { this.tone(53,.46,.025,'triangle',38); this.noise(.18,.008); }
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
  noise(duration: number, volume: number) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, len = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate), a = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 840; filter.Q.value = 1.3;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  }
  open() { this.tone(245, .11, .025, 'sawtooth', 410); this.noise(.08, .026); }
  close() { this.noise(.065, .11); this.tone(190, .08, .13, 'triangle', 47); this.tone(1320, .035, .065, 'square', 520); }
  detected() { this.tone(430, .24, .036, 'sine', 650); this.tone(880, .24, .024, 'sine', 1000); }
  miss() { this.tone(162, .24, .035, 'triangle', 94); }
  cue() { this.tone(960, .08, .011, 'sine', 530); }
}
