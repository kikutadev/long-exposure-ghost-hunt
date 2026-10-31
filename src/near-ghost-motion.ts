import type { GhostSample } from './world';

// The player stays at this world-space point while the shutter is held.
export const PHOTOGRAPHER_POSITION = { x: 0, y: 1.65, z: 5.7 } as const;
export const STRIKE_DISTANCE = 1.85;
export const APPROACH_WARNING_DISTANCE = 8.2;

export function distanceToPhotographer(sample: Pick<GhostSample, 'x' | 'y' | 'z'>): number {
  return Math.hypot(
    sample.x - PHOTOGRAPHER_POSITION.x,
    sample.y - PHOTOGRAPHER_POSITION.y,
    sample.z - PHOTOGRAPHER_POSITION.z
  );
}

export function hasReachedPhotographer(sample: GhostSample): boolean {
  return sample.visible && distanceToPhotographer(sample) <= STRIKE_DISTANCE;
}

/**
 * The ghost advances while exposed. Its two blinks vary with the world time
 * at which the shutter was opened, so repeating a memorised hold is unreliable.
 * The second reappearance puts it *inside* striking distance: that instant is
 * lethal, rather than waiting for an unrelated 1.65-second timer.
 */
export function nearGhostSample(t: number, age: number): GhostSample {
  const startTime = t - age;
  // The first impossible jump now happens while a good photograph is still
  // possible. Its brief stop gives the player a moment to release.
  const firstBlink = .55 + .035 * Math.sin(startTime * 1.8);
  const secondBlink = 1.25 + .065 * Math.sin(startTime * 1.17 + 1.4);
  const firstReturn = firstBlink + .058;
  const secondReturn = secondBlink + .052;
  const vanished = (age >= firstBlink && age < firstReturn)
    || (age >= secondBlink && age < secondReturn);
  // A sudden advance, then a 90ms unnatural pause, then a renewed rush.
  const motionAge = age < firstReturn ? age
    : age < firstReturn + .09 ? firstReturn : age - .09;
  const progress = Math.pow(Math.max(0, Math.min(motionAge / 1.65, 1)), 2.2);
  const naturalZ = -6.4 + progress * 10.9 + (age >= firstReturn ? 2.05 : 0);
  // Reappearing within arm's reach is an attack, not a warning pose.
  const z = age >= secondReturn
    ? Math.max(naturalZ, PHOTOGRAPHER_POSITION.z - 1.55)
    : naturalZ;
  return {
    t,
    x: .1 + .12 * Math.sin(t * 1.7),
    y: 1.6 + .06 * Math.sin(t * 1.4),
    z,
    visible: !vanished,
    size: 1.08
  };
}