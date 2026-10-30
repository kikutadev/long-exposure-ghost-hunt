export type CameraInputCallbacks = {
  canLook: () => boolean;
  canShoot: () => boolean;
  look: (dx: number, dy: number) => void;
  shootStart: () => void;
  shootEnd: () => void;
  cancelExposure: () => void;
};

export function bindCameraInput(
  canvas: HTMLCanvasElement,
  shutter: HTMLButtonElement,
  callbacks: CameraInputCallbacks
) {
  let shootPointer: number | null = null;
  let lookPointer: number | null = null;
  let lookX = 0;
  let lookY = 0;

  function cancel() {
    const wasShooting = shootPointer !== null;
    shootPointer = null;
    lookPointer = null;
    if (wasShooting) callbacks.cancelExposure();
  }

  shutter.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    if (!callbacks.canShoot() || shootPointer !== null) return;
    shootPointer = event.pointerId;
    shutter.setPointerCapture(event.pointerId);
    callbacks.shootStart();
  });

  shutter.addEventListener('pointerup', event => {
    if (event.pointerId !== shootPointer) return;
    event.preventDefault();
    shootPointer = null;
    callbacks.shootEnd();
  });
  shutter.addEventListener('pointercancel', cancel);
  shutter.addEventListener('lostpointercapture', event => {
    if (event.pointerId === shootPointer) cancel();
  });

  canvas.addEventListener('pointerdown', event => {
    if (!callbacks.canLook() || lookPointer !== null) return;
    event.preventDefault();
    lookPointer = event.pointerId;
    lookX = event.clientX;
    lookY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (lookPointer !== event.pointerId || !callbacks.canLook()) return;
    callbacks.look(event.clientX - lookX, event.clientY - lookY);
    lookX = event.clientX;
    lookY = event.clientY;
  });
  const releaseLook = (event: PointerEvent) => {
    if (lookPointer === event.pointerId) lookPointer = null;
  };
  canvas.addEventListener('pointerup', releaseLook);
  canvas.addEventListener('pointercancel', releaseLook);
  canvas.addEventListener('lostpointercapture', releaseLook);

  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  window.addEventListener('orientationchange', cancel);
  document.addEventListener('contextmenu', event => {
    if ((event.target as Element).closest('#device')) event.preventDefault();
  });
}
