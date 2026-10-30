import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCameraInput } from '../src/input.ts';

class Surface extends EventTarget {
  setPointerCapture() {}
}
const fire = (target, name, id = 1, extra = {}) => {
  const event = new Event(name, {cancelable:true});
  Object.assign(event, {pointerId:id,pointerType:'touch',clientX:0,clientY:0,...extra});
  target.dispatchEvent(event);
};
function rig() {
  globalThis.window = new Surface(); globalThis.document = new Surface();
  const canvas = new Surface(), shutter = new Surface();
  const counts = {start:0,end:0,cancel:0,look:0}; let shooting = false;
  bindCameraInput(canvas, shutter, {
    canLook:()=>!shooting,canShoot:()=>!shooting,
    look:()=>counts.look++,shootStart:()=>{counts.start++;shooting=true;},
    shootEnd:()=>{counts.end++;shooting=false;},cancelExposure:()=>{counts.cancel++;shooting=false;}
  });
  return {canvas,shutter,counts};
}
test('only the held finger can release or cancel; release fires once', () => {
  const {shutter,counts}=rig();
  fire(shutter,'pointerdown',1); fire(shutter,'pointerdown',2);
  fire(shutter,'pointercancel',2); fire(shutter,'pointerup',2);
  assert.deepEqual(counts,{start:1,end:0,cancel:0,look:0});
  fire(shutter,'pointerup',1); fire(shutter,'lostpointercapture',1); fire(shutter,'pointerup',1);
  assert.equal(counts.end,1); assert.equal(counts.cancel,0);
});
test('blur and resize cancel safely without taking a photo, then allow retry', () => {
  const {shutter,counts}=rig();
  for(const event of ['blur','resize','orientationchange']) {
    fire(shutter,'pointerdown'); fire(window,event); fire(shutter,'pointerup');
  }
  assert.equal(counts.cancel,3); assert.equal(counts.end,0);
  fire(shutter,'pointerdown'); fire(shutter,'pointerup');
  assert.equal(counts.end,1);
});
test('starting exposure discards an existing look finger', () => {
  const {canvas,shutter,counts}=rig();
  fire(canvas,'pointerdown',2); fire(shutter,'pointerdown',1); fire(shutter,'pointerup',1);
  fire(canvas,'pointermove',2,{clientX:100});
  assert.equal(counts.look,0);
});
