import type { GhostSample } from './world';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type Projection = { x: number; y: number; inView: boolean };
export type ShotResult = { quality: number; success: boolean; label: string; description: string };

export function evaluateShot(
  samples: readonly GhostSample[],
  act: number,
  exposureSeconds: number,
  project: (sample: GhostSample) => Projection
): ShotResult {
  const level = act;
  if (!samples.length) return { quality: 0, success: false, label: 'TOO DARK', description: 'Hold a little longer to gather light.' };
  let energy = 0, blur = 0, framing = 0, seen = 0;
  let prior: { x: number; y: number } | null = null;
  const strength = [1.0, 3.4, 1.65][level];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], p = project(s);
    if (!p.inView) { prior = null; continue; }
    seen++;
    energy += strength / 30;
    const off = Math.hypot(p.x * .68, p.y * .55);
    framing += clamp(1.07 - off * .47, .55, 1);
    if (prior) blur += Math.hypot(p.x - prior.x, p.y - prior.y) * .50;
    prior = p;
  }
  const c = seen ? framing / seen : 0;
  const brightness = clamp(energy / .93, 0, 1);
  const blurFactor = Math.exp(-Math.pow(blur / .80, 1.2));
  const over = energy < 1.48 ? 1 : clamp(1 - (energy - 1.48) * .46, .35, 1);
  let quality = Math.round(100 * brightness * blurFactor * c * over);
  if (level === 2 && exposureSeconds > 1.65) quality = 0;
  const success = quality >= 45 && seen >= 4;
  let label = success ? (quality >= 75 ? 'CRYSTAL CLEAR' : 'GHOST CAPTURED') : 'TOO DARK';
  let description = success ? (quality >= 75 ? 'A perfect paranormal exposure.' : 'The presence is recorded.') : 'Not enough light. Hold the shutter longer.';
  if (!success && level === 2 && exposureSeconds >= 1.65) {
    label = 'TOO LATE'; description = 'It reached the lens before you let go.';
  } else if (!success && seen < 4) {
    label = 'EMPTY FRAME'; description = 'Watch for movement before exposing.';
  } else if (!success && c < .7) {
    label = 'OUT OF FRAME'; description = 'Point the camera toward the disturbance.';
  } else if (!success && blurFactor < .55) {
    label = 'TOO BLURRY'; description = 'A shorter exposure will freeze its motion.';
  } else if (!success && energy > 1.6) {
    label = 'OVEREXPOSED'; description = 'Close the shutter before the light floods in.';
  }
  return { quality, success, label, description };
}
