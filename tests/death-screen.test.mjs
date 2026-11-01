import test from 'node:test';
import assert from 'node:assert/strict';
import { deathDescription, DeathScreen } from '../src/death-screen.ts';

test('distinct death causes retain their own readable explanation', () => {
  assert.match(deathDescription('OVEREXPOSED'), /SHUTTER OPEN/);
  assert.match(deathDescription('TOO CLOSE'), /TOO CLOSE/);
  assert.notEqual(deathDescription('OVEREXPOSED'), deathDescription('TOO CLOSE'));
  assert.match(deathDescription('OVEREXPOSED', 1), /FILM BURNED/);
});


test('death screen show/reset preserves the right ghost and restart visibility', () => {
  const ghost = {src:''};
  const reason = {textContent:''};
  const heading = {textContent:''};
  const classes = new Set(['hidden']);
  const panel = {
    querySelector: selector => selector === '#death-ghost' ? ghost : selector === '#death-reason' ? reason : selector === '#death-heading' ? heading : null,
    classList: {add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name))},
    offsetHeight: 844,
  };
  const view = new DeathScreen(panel, '/long-exposure/');
  view.show('TOO CLOSE', 2);
  assert.equal(ghost.src, '/long-exposure/assets/ghost-near.png');
  assert.match(reason.textContent, /TOO CLOSE/);
  assert.equal(classes.has('hidden'), false);
  assert.equal(classes.has('death-arrive'), true);
  view.reset();
  assert.equal(classes.has('hidden'), true);
  assert.equal(classes.has('death-arrive'), false);
  view.show('OVEREXPOSED', 0);
  assert.equal(ghost.src, '/long-exposure/assets/ghost-base.png');
  assert.match(reason.textContent, /SHUTTER OPEN/);
  view.show('OVEREXPOSED', 1);
  assert.equal(ghost.src, '/long-exposure/assets/ghost-fast.png');
  assert.match(reason.textContent, /FILM BURNED/);
  assert.equal(heading.textContent, 'EXPOSURE\nLOST.');
});
