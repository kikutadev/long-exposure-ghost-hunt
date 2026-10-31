import type { GhostSample } from './world';

/** Owns the samples for one held shutter press. Times remain in the world's clock. */
export class ExposureSession {
  readonly samples: GhostSample[] = [];
  private startedAt = 0;
  private worldStartedAt = 0;
  private lastSampleAt = 0;

  begin(now: number, worldTime: number) {
    this.samples.length = 0;
    this.startedAt = now;
    this.worldStartedAt = worldTime;
    this.lastSampleAt = now;
  }

  reset() {
    this.samples.length = 0;
    this.startedAt = 0;
    this.worldStartedAt = 0;
    this.lastSampleAt = 0;
  }

  elapsed(now: number, limit: number) {
    return Math.max(0, Math.min(now - this.startedAt, limit));
  }

  get recordedAge() { return Math.max(0, this.lastSampleAt - this.startedAt); }

  collect(now: number, limit: number, positionAt: (worldTime: number, exposureAge: number) => GhostSample, final = false) {
    const until = Math.min(now, this.startedAt + limit);
    // Match the original 30Hz timeline, including the fractional release sample.
    while (this.lastSampleAt + 1 / 30 <= until && this.samples.length < 73) {
      this.lastSampleAt += 1 / 30;
      const age = this.lastSampleAt - this.startedAt;
      this.samples.push(positionAt(this.worldStartedAt + age, age));
    }
    if (final && this.lastSampleAt < until && this.samples.length < 73) {
      this.lastSampleAt = until;
      const age = until - this.startedAt;
      this.samples.push(positionAt(this.worldStartedAt + age, age));
    }
  }
}
