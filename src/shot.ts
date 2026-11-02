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
  let priorDepth: number | null = null;
  const start = samples.length ? samples[samples.length - 1].t - seconds : 0;
  let previousTime = start;
  const weights: number[] = [];
  for (const s of samples) {
    const dt = clamp(s.t - previousTime, 0, seconds);
    previousTime = s.t;
    const p = project(s);
    const coverage = p.inView && s.visible ? (p.coverage ?? 1) : 0;
    // Small, distant subjects gather less light; a full subject still needn't be centred.
    const area = p.width && p.height ? clamp(p.width * p.height / .12, .15, act === 1 ? 1.20 : 1.04) : 1;
    const weight = dt * coverage * area;
    weights.push(weight);
    energy += weight * [1, 2.65, 1.35][act];
    if (!coverage) { prior = null; priorDepth = null; continue; }
    visibleTime += dt;
    framing += dt * coverage;
    if (prior) {
      // Fast crossings move sharply, but a short, well-timed burst must remain photographable.
      motion += Math.hypot(p.x - prior.x, p.y - prior.y) * (act === 1 ? .38 : .5);
      // An approaching face leaves nested silhouettes even without lateral motion.
      motion += Math.abs((p.height ?? 0) - (prior.height ?? 0)) * .6;
      // A ghost coming straight down the optical axis also smears across
      // the film even if the centre of its silhouette barely moves.
      if (act === 1 && priorDepth !== null) motion += Math.abs(s.z - priorDepth) * .42;
    }
    prior = p;
    priorDepth = s.z;
  }
  const density = Math.pow(clamp(energy / .95), 2.35);
  const sharpness = Math.exp(-Math.pow(motion / .65, 1.2));
  const bleach = clamp((energy - 1.3) / 1.05);
  const detail = Math.pow(1 - bleach, 1.3);
  const composition = visibleTime ? framing / visibleTime : 0;
  return { energy, density, sharpness, bleach, detail, composition, visibleTime, weights,
    quality: Math.round(100 * density * sharpness * detail * composition) };
}

/** Whether the film contains a readable figure at this instant. Recognition
 * and shot evaluation must use the same standard. */
export function isReadableExposure(film: ReturnType<typeof formExposure>, act: number): boolean {
  return film.quality >= 68 && film.density >= .65
    && film.sharpness >= .62 && film.composition >= .76
    && film.visibleTime >= (act === 1 ? .16 : .24);
}

export function evaluateShot(samples: readonly GhostSample[], act: number, exposureSeconds: number, project: (sample: GhostSample) => Projection): ShotResult {
  const film = formExposure(samples, act, exposureSeconds, project);
  const tooLate = (act === 2 || act === 1) && samples.some(hasReachedPhotographer);
  const quality = tooLate ? 0 : film.quality;
  // A photograph must reveal a readable subject, not merely register a faint
  // spectral trace. Dense but smeared or mostly cropped frames still fail.
  const success = !tooLate && isReadableExposure(film, act);
  let label = success ? (quality >= 85 ? 'CAPTURED' : 'RECORDED') : 'TOO DARK';
  let description = success ? 'The presence is recorded.' : 'Not enough light. Hold the shutter longer.';
  if (!success) {
    if (tooLate) { label = 'TOO LATE'; description = act === 1
      ? 'The runner crossed the lens before you let go.'
      : 'It reached the lens before you let go.'; }
    else if (!film.visibleTime) { label = 'EMPTY FRAME'; description = 'Watch for movement before exposing.'; }
    else if (film.composition < .76) { label = 'OUT OF FRAME'; description = 'Keep the whole presence inside the viewfinder.'; }
    else if (film.sharpness < .62) { label = 'TOO BLURRY'; description = 'A shorter exposure will freeze its motion.'; }
    else if (film.density < .15) { label = 'TOO DARK'; description = 'Not enough light. Hold the shutter longer.'; }
    else if (film.density < .65 || quality < 68) {
      label = 'TOO FAINT'; description = 'The figure never became distinct. Hold a little longer.';
    }
  }
  return { quality, success, label, description };
}

export type DeathCause = 'OVEREXPOSED' | 'EXPOSURE_BREACH' | 'TOO CLOSE' | 'RUN_THROUGH';

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
  const hitsPhotographer = samples.some(hasReachedPhotographer);
  const openTooLong = seconds >= exposureLimit(act);
  const fatalLight = film.visibleTime >= .1 && film.bleach >= .22;
  const impact = (act === 1 || act === 2) && hitsPhotographer;
  return {
    // A blown photograph is now a lethal exposure breach, not a free retry.
    // Physical contact remains its own stronger cause when it happens first.
    cause: act === 2 && impact ? 'TOO CLOSE'
      : act === 1 && impact ? 'RUN_THROUGH'
      : fatalLight ? act === 0 ? 'OVEREXPOSED' : 'EXPOSURE_BREACH'
      : act === 0 && openTooLong ? 'OVEREXPOSED'
      : act === 1 && openTooLong ? 'RUN_THROUGH' : null,
    warning: ((act === 1 || act === 2) && samples.some(s => s.visible && distanceToPhotographer(s) <= APPROACH_WARNING_DISTANCE))
      || (act === 0 && seconds >= 1.45) || film.energy >= 1.06,
  };
}