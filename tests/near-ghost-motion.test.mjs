import test from 'node:test';
import assert from 'node:assert/strict';
import { nearGhostSample } from '../src/near-ghost-motion.ts';

test('safe early exposure stays continuous and visible', () => {
  const poses = [.2, .55, .8, .94].map(t => nearGhostSample(9+t,t));
  assert.ok(poses.every(p => p.visible));
  assert.ok(poses.every((p,i) => i===0 || p.z > poses[i-1].z));
});

test('ghost disappears before each teleport and reappears closer', () => {
  for (const [start,end] of [[.99,1.03],[1.34,1.39]]) {
    assert.equal(nearGhostSample(0,start-.01).visible,true);
    assert.equal(nearGhostSample(0,start+.015).visible,false);
    assert.equal(nearGhostSample(0,end+.015).visible,true);
    assert.ok(nearGhostSample(0,end+.015).z > nearGhostSample(0,start-.01).z);
  }
});

test('repeated captures use only exposure age, not previous attempt state', () => {
  assert.deepEqual(nearGhostSample(1.8,.74),nearGhostSample(1.8,.74));
  assert.ok(nearGhostSample(1.65,1.65).z < 5.7);
});
