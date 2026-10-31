import type { GhostSample } from './world';
import { hasReachedPhotographer, distanceToPhotographer, APPROACH_WARNING_DISTANCE } from './near-ghost-motion.ts';
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

// Width/height are the visible subject footprint in NDC, not just its centre.
export type Projection = { x: number; y: number; inView: boolean; width?: number; height?: number; coverage?: number };
export type ShotResult = { quality: number; success: boolean; label: string; description: string };

/** One film response shared by live sprites, the frozen photo, and scoring.
 * Samples are interval endpoints; the last interval can be less than 1/30 s. */
export function formExposure(samples: readonly GhostSample[], act: number, seconds: number, project: (s: GhostSample) => Projection) {
  let energy = 0, motion = 0, framing = 0, visibleTime = 0;
  let prior: Projection | null = null;
  const start = samples.length ? samples[samples.length - 1].t - seconds : 0;
  let previousTime = start;
  const weights: number[] = [];
  for (const s of samples) {
    const dt = clamp(s.t - previousTime, 0, seconds);
    previousTime = s.t;
    const p = project(s);
    const coverage = p.inView && s.visible ? (p.coverage ?? 1) : 0;
    // Small, distant subjects gather less light; a full subject still needn't be centred.
    const area = p.width && p.height ? clamp(p.width * p.height / .12, .15, 1.35) : 1;
    const weight = dt * coverage * area;
    weights.push(weight);
    energy += weight * [1, 3.4, 1.65][act];
    if (!coverage) { prior = null; continue; }
    visibleTime += dt;
    framing += dt * coverage;
    if (prior) {
      motion += Math.hypot(p.x - prior.x, p.y - prior.y) * .5;
      // An approaching face leaves nested silhouettes even without lateral motion.
      motion += Math.abs((p.height ?? 0) - (prior.height ?? 0)) * .6;
    }
    prior = p;
  }
  const density = Math.pow(clamp(energy / .95), 2.35);
  const sharpness = Math.exp(-Math.pow(motion / .65, 1.2));
  const bleach = clamp((energy - 1.3) / 1.05);
  const detail = Math.pow(1 - bleach, 1.3);
  const composition = visibleTime ? framing / visibleTime : 0;
  return { energy, density, sharpness, bleach, detail, composition, visibleTime, weights,
    quality: Math.round(100 * density * sharpness * detail * composition) };
}

export function evaluateShot(samples: readonly GhostSample[], act: number, exposureSeconds: number, project: (sample: GhostSample) => Projection): ShotResult {
  const film = formExposure(samples, act, exposureSeconds, project);
  const tooLate = act === 2 && samples.some(hasReachedPhotographer);
  const quality = tooLate ? 0 : film.quality;
  const success = quality >= 45 && film.visibleTime >= .10;
  let label = success ? (quality >= 75 ? 'CRYSTAL CLEAR' : 'GHOST CAPTURED') : 'TOO DARK';
  let description = success ? 'The presence is recorded.' : 'Not enough light. Hold the shutter longer.';
  if (!success) {
    if (tooLate) { label = 'TOO LATE'; description = 'It reached the lens before you let go.'; }
    else if (!film.visibleTime) { label = 'EMPTY FRAME'; description = 'Watch for movement before exposing.'; }
    else if (film.composition < .65) { label = 'OUT OF FRAME'; description = 'Keep the whole presence inside the viewfinder.'; }
    else if (film.sharpness < .55) { label = 'TOO BLURRY'; description = 'A shorter exposure will freeze its motion.'; }
    else if (film.bleach > .3) { label = 'OVEREXPOSED'; description = 'The light erased the detail. Try a shorter exposure.'; }
  }
  return { quality, success, label, description };
}

export type DeathCause = 'OVEREXPOSED' | 'TOO CLOSE';

/** Upper bound on film sampling; stage-three attacks are decided by distance, not this cap. */
export const exposureLimit = (_act: number) => 2.4;

/** Fatal danger is derived from the same film response that draws the photograph. */
export function assessFatalExposure(
  samples: readonly GhostSample[],
  act: number,
  seconds: number,
  project: (sample: GhostSample) => Projection
): { cause: DeathCause | null; warning: boolean } {
  const film = formExposure(samples, act, seconds, project);
  const tooClose = act === 2 && samples.some(hasReachedPhotographer);
  const openTooLong = act !== 2 && seconds >= exposureLimit(act);
  const fatalLight = act !== 2 && film.visibleTime >= .1 && film.bleach >= .75;
  return {
    cause: tooClose ? 'TOO CLOSE' : (openTooLong || fatalLight) ? 'OVEREXPOSED' : null,
    warning: (act === 2 && samples.some(s => s.visible && distanceToPhotographer(s) <= APPROACH_WARNING_DISTANCE))
      || (act !== 2 && seconds >= 1.75) || film.bleach >= .35,
  };
}
