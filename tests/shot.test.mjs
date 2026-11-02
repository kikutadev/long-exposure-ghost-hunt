import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateShot } from '../src/shot.ts';
import { nearGhostSample, PHOTOGRAPHER_POSITION } from '../src/near-ghost-motion.ts';

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
  assert.equal(result.label, 'CAPTURED');
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

test('a shot that includes a materialized attacker cannot be captured as a photo', () => {
  const samples = frames(20);
  samples.push({ t: .7, x: 0, y: 1.65, z: PHOTOGRAPHER_POSITION.z - 1.2, size: 1, visible: true });
  const result = evaluateShot(samples, 2, .7, center);
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

test('distance alone decides the kill, even outside the viewfinder', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const empty = () => ({x: 3, y: 3, inView: false});
  const far = {t: .2, x: 0, y: 1.65, z: -5, size: 1, visible: true};
  const near = {...far, z: PHOTOGRAPHER_POSITION.z - 1.3};
  assert.equal(assessFatalExposure([far], 2, 1.9, empty).cause, null,
    'a clock alone must never kill the photographer');
  assert.equal(assessFatalExposure([near], 2, .2, empty).cause, 'TOO CLOSE',
    'even a very early approach must kill');
  assert.equal(assessFatalExposure([{...near,visible:false}], 2, .2, empty).cause, null,
    'a ghost between teleport locations is not physically present');
});

test('prolonged shutter hold always kills even outside the frame', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const empty = () => ({x: 3, y: 3, inView: false});
  assert.equal(assessFatalExposure(timed(2.20), 0, 2.20, empty).cause, null);
  assert.equal(assessFatalExposure(timed(2.40), 0, 2.40, empty).cause, 'OVEREXPOSED');
});

test('the second apparition rushing down the lens axis destroys sharpness', async () => {
  const {formExposure} = await import('../src/shot.ts');
  const still = timed(.5).map(s => ({...s, z: -4.45}));
  const charging = still.map(s => ({...s, z: -4.45 + s.t * 15}));
  assert.ok(formExposure(still, 1, .5, center).sharpness > .95);
  assert.ok(formExposure(charging, 1, .5, center).sharpness < .4);
});

test('act two: overexposed film now kills before the collision', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const far = timed(2.15);
  const empty = () => ({x: 3, y: 0, inView: false});
  assert.equal(assessFatalExposure(far, 1, 2.15, center).cause, 'EXPOSURE_BREACH',
    'overexposure is never a free retry');
  assert.equal(evaluateShot(far, 1, 2.15, center).success, false,
    'the same exposure can still ruin the photograph');
  const hit = {...far.at(-1), t: 2.16, x: 0, y: 1.65, z: PHOTOGRAPHER_POSITION.z - 1.2};
  assert.equal(assessFatalExposure([...far,hit], 1, 2.16, empty).cause, 'RUN_THROUGH');
  assert.equal(assessFatalExposure(far, 1, 2.40, empty).cause, 'RUN_THROUGH',
    'holding the shutter indefinitely cannot evade the runner');
});

test('second teleport immediately materializes inside the kill radius', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const recognizedAt = .65;
  const frames = Array.from({length: 54},(_,i) => {
    const age = (i+1)/30;
    return nearGhostSample(4+age, age, recognizedAt);
  });
  const firstContactIndex = frames.findIndex(s => s.visible && Math.hypot(
    s.x-PHOTOGRAPHER_POSITION.x,s.y-PHOTOGRAPHER_POSITION.y,s.z-PHOTOGRAPHER_POSITION.z
  ) <= 1.85);
  assert.ok(firstContactIndex > 0);
  assert.equal(assessFatalExposure(frames.slice(0, firstContactIndex),2,1.65,()=>({...center(),inView:false})).cause,null);
  assert.equal(assessFatalExposure(frames.slice(0, firstContactIndex+1),2,.5,center).cause,'TOO CLOSE');
});
test('a faint, mostly cropped or smeared ghost is not a successful photo', () => {
  const values = timed(1.03);
  assert.equal(evaluateShot(values, 0, 1.03, () => ({...center(), coverage:.65})).success, false);
  assert.equal(evaluateShot(values, 0, 1.03, () => ({...center(), width:.08, height:.1})).success, false);
  assert.equal(evaluateShot(timed(.54), 0, .54, center).success, false);
});

test('a damaging exposure warns before instantly ending the run in every act', async () => {
  const {assessFatalExposure} = await import('../src/shot.ts');
  const warn = timed(1.40);
  const burn = timed(1.60);
  assert.equal(assessFatalExposure(warn, 0, 1.40, center).warning, true);
  assert.equal(assessFatalExposure(burn, 0, 1.60, center).cause, 'OVEREXPOSED');
  assert.equal(assessFatalExposure(burn, 1, 1.60, center).cause, 'EXPOSURE_BREACH');
  assert.equal(assessFatalExposure(burn, 2, 1.60, center).cause, 'EXPOSURE_BREACH');
});
