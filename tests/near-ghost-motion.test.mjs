import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearGhostSample, hasReachedPhotographer, distanceToPhotographer,
  STRIKE_DISTANCE
} from '../src/near-ghost-motion.ts';

test('early shutter release is safe and the ghost is still distant', () => {
  const poses = [.2, .55, .8].map(age => nearGhostSample(4 + age, age));
  assert.ok(poses.every(p => p.visible && !hasReachedPhotographer(p)));
  assert.ok(poses.every((p, i) => i === 0 || p.z > poses[i - 1].z));
});

test('both disappearances are real; second reappearance is instant contact', () => {
  for (const startTime of [0, 2.3, 5.1]) {
    const history = Array.from({ length: 180 }, (_, i) => {
      const age = i / 100;
      return nearGhostSample(startTime + age, age);
    });
    const vanishingEdges = history.filter((s, i) => i > 0 && !s.visible && history[i-1].visible);
    assert.equal(vanishingEdges.length, 2);
    assert.ok(history.every(s => !s.visible || !hasReachedPhotographer(s) || distanceToPhotographer(s) <= STRIKE_DISTANCE));
    const strikeIndex = history.findIndex(hasReachedPhotographer);
    assert.ok(strikeIndex > 0 && strikeIndex < history.length);
    assert.equal(history[strikeIndex - 1].visible, false, 'reappearance must be the lethal event');
  }
});

test('the approach varies by shutter start time, not one fixed fatal second', () => {
  const firstLethalAge = startTime => {
    for (let i = 0; i < 180; i++) {
      const age = i / 100;
      if (hasReachedPhotographer(nearGhostSample(startTime + age, age))) return age;
    }
    throw new Error('No contact');
  };
  assert.ok(Math.abs(firstLethalAge(0) - firstLethalAge(4)) >= .05);
});

test('the same shutter history produces the same motion', () => {
  assert.deepEqual(nearGhostSample(8.4,.74),nearGhostSample(8.4,.74));
});
