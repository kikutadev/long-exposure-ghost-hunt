import * as THREE from 'three';
import RiveCanvas from '@rive-app/canvas-advanced';
import wasmUrl from '@rive-app/canvas-advanced/rive.wasm?url';

/** Rive animates the apparition; Three.js owns its position and photographs. */
export class RiveGhost {
  readonly texture: THREE.CanvasTexture;
  private canvas = document.createElement('canvas');
  private elapsed = -1;
  private animation: import('@rive-app/canvas-advanced').LinearAnimationInstance | null = null;
  private artboard: import('@rive-app/canvas-advanced').Artboard | null = null;
  private renderer: import('@rive-app/canvas-advanced').WrappedRenderer | null = null;
  private runtime: Awaited<ReturnType<typeof RiveCanvas>> | null = null;
  private file: import('@rive-app/canvas-advanced').File | null = null;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 768;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }

  async load(url: string) {
    const [rive, fileResponse] = await Promise.all([
      RiveCanvas({ locateFile: () => wasmUrl }),
      fetch(url)
    ]);
    if (!fileResponse.ok) throw new Error('Rive ghost HTTP ' + fileResponse.status);
    const file = await rive.load(new Uint8Array(await fileResponse.arrayBuffer()), undefined, false);
    this.runtime = rive;
    this.file = file;
    this.artboard = file.defaultArtboard();
    this.animation = new rive.LinearAnimationInstance(this.artboard.animationByName('Approach'), this.artboard);
    this.renderer = rive.makeRenderer(this.canvas);
    this.renderAt(0, true);
  }

  renderAt(age: number, force = false) {
    if (!this.animation || !this.artboard || !this.renderer || !this.runtime) return;
    const time = Math.max(0, Math.min(age, 1.65));
    if (!force && Math.abs(time - this.elapsed) < 1 / 40) return;
    this.elapsed = time;
    this.animation.time = time;
    this.animation.apply(1);
    this.artboard.advance(0);
    this.renderer.beginFrame();
    this.renderer.save();
    this.renderer.align(this.runtime.Fit.contain, this.runtime.Alignment.center,
      { minX: 0, minY: 0, maxX: 512, maxY: 768 }, this.artboard.bounds);
    this.artboard.draw(this.renderer);
    this.renderer.restore();
    this.renderer.flush();
    this.runtime.resolveAnimationFrame();
    this.texture.needsUpdate = true;
  }

  reset() { this.renderAt(0, true); }

  dispose() {
    this.animation?.delete();
    this.artboard?.delete();
    this.file?.unref();
    this.renderer?.delete();
    this.texture.dispose();
  }
}
