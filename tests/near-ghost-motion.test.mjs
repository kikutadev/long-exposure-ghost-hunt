import test from 'node:test';
import assert from 'node:assert/strict';
import {nearGhostSample, hasReachedPhotographer, distanceToPhotographer, STRIKE_DISTANCE} from '../src/near-ghost-motion.ts';

test('before recognition, subject approaches slowly and can still reach camera', () => {
  assert.ok([.2,.5,.8].every(age => !hasReachedPhotographer(nearGhostSample(age,age))));
  assert.ok(hasReachedPhotographer(nearGhostSample(2,2)));
});

test('recognition makes the subject stop, then disappear and reappear closer', () => {
  const at = .64;
  const frozen = [at+.02,at+.1,at+.14].map(age => nearGhostSample(age,age,at));
  assert.ok(frozen.every(s => s.visible && s.z === frozen[0].z));
  const vanished = nearGhostSample(at+.18,at+.18,at);
  const returned = nearGhostSample(at+.23,at+.23,at);
  assert.equal(vanished.visible, false);
  assert.equal(returned.visible,true);
  assert.ok(returned.z > frozen[0].z + 2);
  assert.equal(hasReachedPhotographer(returned),false);
});

test('second apparition contacts and kills immediately, even outside the viewfinder', () => {
  for (const at of [.43,.65,.94]) {
    const lastGap = nearGhostSample(at+.54,at+.54,at);
    const strike = nearGhostSample(at+.59,at+.59,at);
    assert.equal(lastGap.visible,false);
    assert.equal(strike.visible,true);
    assert.ok(distanceToPhotographer(strike) <= STRIKE_DISTANCE);
    assert.equal(hasReachedPhotographer(strike),true);
  }
});

test('photo recognition timing changes the danger window', () => {
  const firstLethalAge = recognizedAt => {
    for(let i=1;i<240;i++){
      const age=i/100;
      if(hasReachedPhotographer(nearGhostSample(age,age,recognizedAt)))return age;
    }
    throw Error('No contact');
  };
  assert.ok(firstLethalAge(.9) - firstLethalAge(.45) > .40);
});

test('same recognition history gives identical ghost position', () => {
  assert.deepEqual(nearGhostSample(8.4,.74,.55),nearGhostSample(8.4,.74,.55));
});
