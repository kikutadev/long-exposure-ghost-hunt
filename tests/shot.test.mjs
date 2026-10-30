import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateShot } from '../src/shot.ts';

const sample = (index, visible = true) =>
  ({ t: index / 30, x: 0, y: 1.6, z: -5, size: 1, visible });
const frames = count => Array.from({ length: count }, (_, i) => sample(i));
const center = () => ({ x: 0, y: 0, inView: true });

test('nothing in the frame cannot count as a ghost photo', () => {
  const result = evaluateShot(frames(45), 0, 1.5, () => ({ x: 3, y: 0, inView: false }));
  assert.equal(result.success, false);
  assert.equal(result.label, 'EMPTY FRAME');
});

test('too little light is not a successful exposure', () => {
  const result = evaluateShot(frames(6), 0, .2, center);
  assert.equal(result.success, false);
  assert.equal(result.label, 'TOO DARK');
});

test('a still, fully exposed ghost produces a clear picture', () => {
  const result = evaluateShot(frames(36), 0, 1.2, center);
  assert.equal(result.success, true);
  assert.equal(result.label, 'CRYSTAL CLEAR');
  assert.ok(result.quality >= 75);
});

test('a fast ghost blurs on a long exposure even with abundant light', () => {
  const samples = frames(50);
  let index = 0;
  const result = evaluateShot(samples, 1, 1.67, () =>
    ({ x: (index++ % 2 ? .4 : -.4), y: 0, inView: true }));
  assert.equal(result.success, false);
  assert.equal(result.label, 'TOO BLURRY');
});

test('approaching ghost reaches the lens at the deadline', () => {
  const result = evaluateShot(frames(50), 2, 1.66, center);
  assert.equal(result.success, false);
  assert.equal(result.label, 'TOO LATE');
});
