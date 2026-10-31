import test from 'node:test';
import assert from 'node:assert/strict';
import { ExposureSession } from '../src/exposure-session.ts';
import { formExposure } from '../src/shot.ts';

const positionAt = (t, age) => ({t, x: age, y: 1.6, z: -5, visible: true, size: 1});
const center = () => ({x: 0, y: 0, inView: true});

test('release records 30Hz samples plus the fractional last interval', () => {
  const session = new ExposureSession();
  session.begin(100, 7);
  session.collect(100.42, 2.4, positionAt, true);
  assert.equal(session.samples.length, 13);
  assert.ok(Math.abs(session.recordedAge - .42) < 1e-9);
  assert.ok(Math.abs(session.samples.at(-1).t - 7.42) < 1e-9);
  assert.ok(Math.abs(formExposure(session.samples, 0, session.elapsed(100.42, 2.4), center).energy - .42) < 1e-9);
});

test('sampling respects its time cap and cannot duplicate final samples', () => {
  const session = new ExposureSession();
  session.begin(10, 30);
  session.collect(12.9, 1.65, positionAt, true);
  assert.equal(session.samples.length, 50);
  assert.ok(Math.abs(session.recordedAge - 1.65) < 1e-9);
  session.collect(13, 1.65, positionAt, true);
  assert.equal(session.samples.length, 50);
  assert.equal(session.elapsed(13, 1.65), 1.65);
});

test('cancel and restart discard samples and begin at the new world time', () => {
  const session = new ExposureSession();
  session.begin(30, 12);
  session.collect(30.2, 2.4, positionAt);
  assert.ok(session.samples.length > 0);
  session.reset();
  assert.equal(session.samples.length, 0);
  session.begin(70, 0);
  session.collect(70.1, 2.4, positionAt, true);
  assert.equal(session.samples.length, 3);
  assert.ok(Math.abs(session.samples.at(-1).t - .1) < 1e-9);
});
