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

// Interval endpoints (including the final fractional interval) mirror capture.
const timed = (seconds, hz = 30) => Array.from({length: Math.ceil(seconds * hz)}, (_, i) =>
  ({ ...sample(i), t: Math.min((i + 1) / hz, seconds) }));

test('QA regression: .42s is weak, 1.10s clear, 2.15s bleached', async () => {
  const { formExposure } = await import('../src/shot.ts');
  const films = [.42, 1.10, 2.15].map(t => formExposure(timed(t), 0, t, center));
  assert.ok(films[0].density < .2);
  assert.ok(films[1].density > .95 && films[1].bleach === 0);
  assert.ok(films[2].bleach > .75);
  assert.deepEqual([.42, 1.10, 2.15].map(t => evaluateShot(timed(t), 0, t, center).success), [false, true, false]);
});

test('exposure energy uses elapsed time, not sample count', async () => {
  const { formExposure } = await import('../src/shot.ts');
  const films = [15, 30, 60, 120].map(hz => formExposure(timed(.42, hz), 0, .42, center));
  films.forEach(film => assert.ok(Math.abs(film.energy - .42) < 1e-10));
  assert.equal(new Set(films.map(film => film.quality)).size, 1);
  assert.ok(formExposure(timed(.005), 0, .005, center).density < .001);
});

test('partially clipped and distant ghosts lose visible exposure', async () => {
  const { formExposure } = await import('../src/shot.ts');
  const full = formExposure(timed(1.1), 0, 1.1, center);
  const clipped = formExposure(timed(1.1), 0, 1.1, () => ({...center(), coverage: .3}));
  const distant = formExposure(timed(1.1), 0, 1.1, () => ({...center(), width: .1, height: .1}));
  assert.ok(clipped.quality < 20 && distant.quality < 20);
  assert.ok(full.quality >= 75);
});

test('approach expansion blurs even with a stationary centre', async () => {
  const { formExposure } = await import('../src/shot.ts');
  const film = formExposure(timed(.9), 2, .9, s => ({...center(), width: .3, height: .3 + s.t * 1.8}));
  assert.ok(film.sharpness < .3);
});

test('fast ghost rewards a brief pass and rejects a long trail', () => {
  const project = s => ({x: -.25 + s.t * 1.1, y: 0, inView: true});
  assert.equal(evaluateShot(timed(.35), 1, .35, project).success, true);
  assert.equal(evaluateShot(timed(1.5), 1, 1.5, project).success, false);
});

test('invisible samples never add film density even with an in-view centre', async () => {
  const {formExposure} = await import('../src/shot.ts');
  const film = formExposure(timed(1).map(s => ({...s,visible:false})), 0, 1, center);
  assert.equal(film.energy, 0);
  assert.equal(film.quality, 0);
});

test('fatal exposure obeys distinct safe, warning and lethal thresholds', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const safe = assessFatalExposure(timed(1.10), 0, 1.10, center);
  const warning = assessFatalExposure(timed(1.80), 0, 1.80, center);
  const dead = assessFatalExposure(timed(2.15), 0, 2.15, center);
  assert.equal(safe.cause, null);
  assert.equal(warning.warning, true);
  assert.equal(dead.cause, 'OVEREXPOSED');
});

test('approaching spirit kills at contact but not while still safely distant', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const empty = () => ({x: 3, y: 3, inView: false});
  assert.equal(assessFatalExposure(timed(.75), 2, .75, empty).cause, null);
  assert.equal(assessFatalExposure(timed(1.60), 2, 1.60, empty).cause, null);
  assert.equal(assessFatalExposure(timed(1.65), 2, 1.65, empty).cause, 'TOO CLOSE');
});

test('prolonged shutter hold always kills even outside the frame', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const empty = () => ({x: 3, y: 3, inView: false});
  assert.equal(assessFatalExposure(timed(2.20), 0, 2.20, empty).cause, null);
  assert.equal(assessFatalExposure(timed(2.40), 0, 2.40, empty).cause, 'OVEREXPOSED');
});

test('third act prioritizes dangerous proximity over optical bleaching', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  assert.equal(assessFatalExposure(timed(1.35), 2, 1.35, center).cause, null);
  assert.equal(assessFatalExposure(timed(1.65), 2, 1.65, center).cause, 'TOO CLOSE');
});
