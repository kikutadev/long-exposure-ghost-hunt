import type { GhostSample } from './world';

/** Two impossible short-distance jumps, sharing the exposure sampler's clock. */
export function nearGhostSample(t: number, age: number): GhostSample {
  const progress = Math.pow(Math.max(0, Math.min(age / 1.65, 1)), 2.2);
  const invisible = (age >= .99 && age < 1.03) || (age >= 1.34 && age < 1.39);
  const jump = (age >= 1.03 ? .50 : 0) + (age >= 1.39 ? .22 : 0);
  return {
    t,
    x: .1 + .12 * Math.sin(t * 1.7),
    y: 1.6 + .06 * Math.sin(t * 1.4),
    z: -6.4 + progress * 10.9 + jump,
    visible: !invisible,
    size: 1.08
  };
}
