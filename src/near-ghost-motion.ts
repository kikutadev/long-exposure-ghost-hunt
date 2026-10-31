import type { GhostSample } from './world';

export const PHOTOGRAPHER_POSITION = { x: 0, y: 1.65, z: 5.7 } as const;
export const STRIKE_DISTANCE = 1.85;
export const APPROACH_WARNING_DISTANCE = 8.2;

export function distanceToPhotographer(sample: Pick<GhostSample, 'x' | 'y' | 'z'>): number {
  return Math.hypot(sample.x, sample.y - PHOTOGRAPHER_POSITION.y, sample.z - PHOTOGRAPHER_POSITION.z);
}

export function hasReachedPhotographer(sample: GhostSample): boolean {
  return sample.visible && distanceToPhotographer(sample) <= STRIKE_DISTANCE;
}

/** Before the film makes the figure identifiable, the presence still approaches.
 * Looking away cannot make an open shutter safe indefinitely. */
export function nearGhostSample(t: number, age: number, recognizedAt: number | null = null): GhostSample {
  const clamp = (x: number) => Math.max(0, Math.min(x, 1));
  const slow = Math.pow(clamp(age / 1.95), 1.8);
  let z = -6.4 + slow * 10.7;
  let visible = true;
  if (recognizedAt !== null && age >= recognizedAt) {
    const reaction = age - recognizedAt;
    const holdZ = -6.4 + Math.pow(clamp(recognizedAt / 1.95), 1.8) * 10.7;
    // The ghost notices the camera and FREEZES. The stillness is a warning.
    if (reaction < .15) z = holdZ;
    else if (reaction < .22) { z = holdZ; visible = false; }
    else if (reaction < .51) {
      // Not a smooth camera-facing walk: it is suddenly several desks closer.
      const rush = clamp((reaction - .22) / .29);
      z = -1.65 + 1.25 * (rush * rush);
    } else if (reaction < .57) { z = -.4; visible = false; }
    else z = PHOTOGRAPHER_POSITION.z - 1.52; // lethal at materialization, never a timed "free pass"
  }
  return {
    t,
    x: .1 + .08 * Math.sin(t * 1.7),
    y: 1.6,
    z,
    visible,
    size: 1.08
  };
}
