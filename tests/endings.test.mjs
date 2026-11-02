import test from 'node:test';
import assert from 'node:assert/strict';
import {ENDINGS, EndingArchive, completionEnding} from '../src/endings.ts';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
};

test('existing four discoveries survive the six-outcome expansion', () => {
  const storage = makeStorage();
  const first = new EndingArchive(storage);
  assert.equal(first.count, 0);
  assert.deepEqual(ENDINGS.map(e => e.id), ['seen', 'run-through', 'reached', 'breach', 'fourth', 'pristine']);
  assert.equal(first.unlock('run-through'), true);
  assert.equal(first.unlock('run-through'), false);
  assert.equal(first.unlock('fourth'), true);
  assert.equal(first.count, 2);
  const reloaded = new EndingArchive(storage);
  assert.equal(reloaded.count, 2);
  assert.equal(reloaded.has('seen'), false);
  assert.equal(reloaded.has('run-through'), true);
  assert.equal(reloaded.has('fourth'), true);
});

test('invalid or inaccessible local storage does not break collection', () => {
  const bad = {getItem: () => '{bad json', setItem: () => {throw Error('blocked')}};
  const archive = new EndingArchive(bad);
  assert.equal(archive.count, 0);
  archive.unlock('seen');
  assert.equal(archive.count, 1);
  const unknown = {getItem: () => '["fourth","fake","fourth"]', setItem: () => {}};
  assert.equal(new EndingArchive(unknown).count, 1);
});

test('only three consistently excellent photographs yield the rare clear ending', () => {
  assert.equal(completionEnding([90, 85, 96]), 'pristine');
  assert.equal(completionEnding([90, 84, 96]), 'fourth');
  assert.equal(completionEnding([99, 99]), 'fourth');
});
