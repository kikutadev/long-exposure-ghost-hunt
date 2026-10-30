import * as THREE from 'three';
import { decorateClassroom } from './atmosphere';

export type GhostSample = { t: number; x: number; y: number; z: number; visible: boolean; size: number };
const fixed = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function box(scene: THREE.Scene, size: [number, number, number], at: [number, number, number], color: number, rough = .9) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  mesh.position.set(...at);
  scene.add(mesh);
  return mesh;
}
function plank(scene: THREE.Scene, from: [number, number, number], to: [number, number, number], thickness: number, color: number) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, d.length(), 6), new THREE.MeshStandardMaterial({ color, roughness: .88 }));
  mesh.position.copy(a.add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  scene.add(mesh);
  return mesh;
}

export class GhostWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, .1, 45);
  private act = 0;
  private yaw = -.07;
  private pitch = -.03;
  private textures: THREE.Texture[] = [];
  private sprites: THREE.Sprite[] = [];
  private dust: THREE.Points;
  private flicker: THREE.PointLight;
  private hintLight: THREE.PointLight;
  private cueBar: THREE.Mesh;
  private frontFluorescent!: THREE.MeshStandardMaterial;
  private book: THREE.Mesh;
  private photoWasExposing = false;
  private curtain: THREE.Mesh;
  private atmosphere: ReturnType<typeof decorateClassroom>;
  private viewportW = 1;
  private viewportH = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x080f12);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.36;
    this.scene.background = new THREE.Color(0x10181b);
    this.scene.fog = new THREE.FogExp2(0x10191b, .024);
    this.camera.position.set(0, 1.65, 5.7);
    this.pointAtYaw();
    this.buildRoom();
    this.atmosphere = decorateClassroom(this.scene);

    const count = 180, values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      values[3 * i] = (Math.sin(i * 124.17) * 4.6);
      values[3 * i + 1] = .28 + (i * 0.137) % 3.0;
      values[3 * i + 2] = -7 + (i * .177) % 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(values, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd6e3cf, size: .018, transparent: true, opacity: .42, sizeAttenuation: true }));
    this.scene.add(this.dust);
    this.flicker = new THREE.PointLight(0xccefdc, 11, 12, 2);
    this.flicker.position.set(0, 3.0, -3);
    this.scene.add(this.flicker);
    this.hintLight = new THREE.PointLight(0x55e7ed, 0, 4.5, 2);
    this.scene.add(this.hintLight);
    this.book = box(this.scene, [.45, .018, .30], [-.84, .74, -4.9], 0x96917a);
    this.book.rotation.y = -.5;
    this.cueBar = box(this.scene, [.45, .038, .05], [-3.95, 1.55, -5.8], 0x51c1b5);
    this.cueBar.visible = false;
    this.curtain = box(this.scene, [.02, 3.4, 4.5], [-4.97, 1.8, -3.5], 0x20343a);
    this.curtain.visible = true;
  }

  async load() {
    const loader = new THREE.TextureLoader();
    const names = ['ghost-base.png', 'ghost-fast.png', 'ghost-near.png'];
    this.textures = await Promise.all(names.map(n => loader.loadAsync(`${import.meta.env.BASE_URL}assets/${n}`)));
    this.textures.forEach(t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    });
    for (let act = 0; act < 3; act++) {
      for (let i = 0; i < 20; i++) {
        const mat = new THREE.SpriteMaterial({ map: this.textures[act], transparent: true, opacity: 0, depthWrite: false, depthTest: false, color: 0xc3f7ff, toneMapped: false });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        sprite.scale.set(1.88, 2.88, 1);
        this.scene.add(sprite);
        this.sprites.push(sprite);
      }
    }
    this.updateViewport();
  }

  private buildRoom() {
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight(0x7a91a4, 0x31281c, 2.0));
    const overhead = new THREE.DirectionalLight(0xbfc8af, 1.1);
    overhead.position.set(2, 7, 1);
    sc.add(overhead);
    box(sc, [10.4, .14, 15.6], [0, -.09, -.9], 0x34382f);
    box(sc, [10.4, .13, 15.6], [0, 3.6, -.9], 0x394441);
    box(sc, [10.4, 3.7, .18], [0, 1.8, -8.6], 0x5d6259);
    box(sc, [.15, 3.7, 15.6], [-5.1, 1.8, -.9], 0x465653);
    box(sc, [.15, 3.7, 15.6], [5.1, 1.8, -.9], 0x454d49);

    for (let i = -5; i <= 5; i++) {
      const z = -1 + i * 1.3;
      box(sc, [10.0, .008, .024], [0, .005, z], i % 2 ? 0x5b5b49 : 0x454639);
    }
    for (let x = -4; x <= 4; x += 1.3) box(sc, [.012, .01, 15], [x, .012, -1], 0x29312c);
    for (let x = -4.1; x < 5; x += .74) {
      box(sc, [.02, 3.5, .07], [x, 1.75, -8.45], 0x78817a);
    }
    box(sc, [6.8, 1.6, .13], [0, 2.04, -8.38], 0x182e30);
    box(sc, [7.0, .095, .16], [0, 2.9, -8.29], 0x856e48);
    box(sc, [7.0, .095, .16], [0, 1.2, -8.29], 0x856e48);
    for (let i = 0; i < 12; i++) {
      const x = Math.sin(i * 28.4) * 2.3;
      const y = 1.64 + Math.sin(i * 13.77) * .45;
      plank(sc, [x, y, -8.28], [x + .1 + (i % 4) * .055, y + .018, -8.28], .006, 0x768d83);
    }
    for (let i = 0; i < 3; i++) {
      const z = -6 + i * 3.5;
      box(sc, [.12, 1.45, 2.1], [5.0, 2.2, z], 0x151f23);
      box(sc, [.14, .06, 2.35], [4.9, 2.83, z], 0x9ba59c);
      box(sc, [.14, .06, 2.35], [4.9, 1.55, z], 0x9ba59c);
      box(sc, [.13, 1.3, .035], [4.88, 2.23, z], 0xa6bab4);
    }
    const moon = new THREE.PointLight(0x80c6db, 12, 11, 2);
    moon.position.set(4.6, 2.8, -2.6);
    sc.add(moon);
    for (let x of [-2.6, 0, 2.6]) for (let z of [-5.7, -3.25, -.8]) {
      box(sc, [1.45, .12, .78], [x, .79, z], 0x735b43);
      box(sc, [1.45, .035, .79], [x, .86, z], 0x9c8160);
      for (let dx of [-.57, .57]) for (let dz of [-.26, .26])
        box(sc, [.075, .73, .075], [x + dx, .39, z + dz], 0x48483c);
      box(sc, [1.1, .48, .05], [x, 1.18, z + .85], 0x635543);
      box(sc, [.10, .55, .08], [x - .5, .59, z + .75], 0x474438);
      box(sc, [.10, .55, .08], [x + .5, .59, z + .75], 0x474438);
    }
    box(sc, [1.0, .045, .6], [2.8, .92, -5.6], 0x493e31);
    box(sc, [1.3, 1.7, .1], [-4.6, 1.7, -6.8], 0x7b6955);
    box(sc, [1.08, 1.32, .12], [-4.55, 1.78, -6.8], 0x373b37);
    box(sc, [.13, .13, .06], [-4.51, 1.69, -6.72], 0xaca490);
    const circle = new THREE.Mesh(new THREE.RingGeometry(.21, .25, 32), new THREE.MeshBasicMaterial({ color: 0xb4b7a4 }));
    circle.position.set(3.8, 2.65, -8.23); sc.add(circle);
    plank(sc, [3.8, 2.65, -8.2], [3.8, 2.75, -8.19], .008, 0xc9cfca);
    const lamp = box(sc, [2.2, .09, .28], [0, 3.39, -3.6], 0xc5d5c8);
    this.frontFluorescent = lamp.material as THREE.MeshStandardMaterial;
    this.frontFluorescent.emissive.setHex(0xb4e1d3);
    this.frontFluorescent.emissiveIntensity = 1.25;
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 2.6;
      const z = -5.7 + Math.floor(i / 3) * 2.8;
      plank(sc, [x - .65, 2.95, z], [x + .65, 2.95, z], .015, 0x525c53);
    }
  }

  private pointAtYaw() {
    const direction = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.lookAt(this.camera.position.clone().add(direction));
  }

  look(dx: number, dy: number) {
    this.yaw = fixed(this.yaw - dx * .0033, -1.08, 1.08);
    this.pitch = fixed(this.pitch + dy * .0022, -.22, .22);
    this.pointAtYaw();
  }

  updateViewport() {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.viewportW = Math.max(1, Math.round(rect.width));
    this.viewportH = Math.max(1, Math.round(rect.height));
    this.camera.aspect = this.viewportW / this.viewportH;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.viewportW, this.viewportH, false);
  }

  setAct(act: number) {
    this.act = act;
    this.yaw = act === 1 ? -.13 : act === 2 ? 0 : -.07;
    this.pitch = -.025;
    this.pointAtYaw();
    this.hideGhosts();
  }

  positionAt(t: number, exposureAge = 0): GhostSample {
    const a = this.act;
    if (a === 0) {
      return { t, x: -.45 + .7 * Math.sin(t * .9), y: 1.6 + .06 * Math.sin(t * 1.7), z: -5.7, visible: true, size: 1 };
    }
    if (a === 1) {
      const phase = ((t + .15) % 2.6 + 2.6) % 2.6;
      const active = phase < 1.05;
      const pos = Math.min(1, phase / 1.05);
      return { t, x: -2.4 + pos * 4.8, y: 1.50 + .03 * Math.sin(t * 18), z: -5.4, visible: active, size: .92 };
    }
    const approach = fixed(exposureAge / 1.65, 0, 1);
    return { t, x: .1 + .12 * Math.sin(t * 1.7), y: 1.6 + .06 * Math.sin(t * 1.4), z: -6.4 + approach * 5.1, visible: true, size: 1.08 };
  }

  project(sample: GhostSample) {
    const world = new THREE.Vector3(sample.x, sample.y, sample.z);
    const ndc = world.project(this.camera);
    return { x: ndc.x, y: ndc.y, inView: sample.visible && ndc.z >= -1 && ndc.z <= 1 && Math.abs(ndc.x) < 1.12 && Math.abs(ndc.y) < 1.2 };
  }

  tick(dt: number, time: number, exposing: boolean, exposureAge = 0) {
    this.dust.rotation.y += dt * .002;
    const glitch = (Math.sin(time * 5.2) + Math.sin(time * 12.7) * .4) * .09;
    this.flicker.intensity = (this.act === 2 ? 3 : 9) + glitch;
    this.frontFluorescent.emissiveIntensity = (this.act === 2 ? .36 : 1.2) + Math.max(0, glitch);
    this.book.rotation.z = .02 * Math.sin(time * 4.5) + (this.act === 0 ? .07 * Math.sin(time * 13) : 0);
    const pos = this.positionAt(time, exposureAge);
    this.atmosphere.update(time, this.act, exposing, new THREE.Vector3(pos.x, pos.y, pos.z), exposureAge);
    this.hintLight.position.set(pos.x, pos.y, pos.z);
    const pulse = this.act === 1 ? .65 + Math.abs(Math.sin(time * 8)) * 2.3 : this.act === 2 ? .65 + Math.sin(time * 2.5) * .35 : .65 + Math.sin(time * 3) * .3;
    this.hintLight.intensity = exposing ? .5 : pulse;
    this.cueBar.visible = this.act === 1 && !exposing;
    if (this.cueBar.visible) this.cueBar.position.x = pos.x;
    this.curtain.position.z = -3.5 + Math.sin(time * .6) * .06;
    if (!exposing && this.photoWasExposing) { this.hideGhosts(); this.photoWasExposing = false; }
  }

  hideGhosts() { this.sprites.forEach(s => { s.visible = false; }); }

  showExposure(samples: GhostSample[], exposureSeconds: number) {
    this.photoWasExposing = true;
    this.hideGhosts();
    if (!samples.length) return;
    const a = this.act;
    const gain = Math.min(1, exposureSeconds * [1.14, 3.9, 2.2][a]);
    const count = Math.min(19, samples.length);
    const start = a * 20;
    for (let j = 0; j < count; j++) {
      const index = count === 1 ? samples.length - 1 : Math.round(j * (samples.length - 1) / Math.max(1, count - 1));
      const s = samples[index];
      if (!s.visible) continue;
      const sprite = this.sprites[start + j];
      sprite.position.set(s.x, s.y, s.z);
      sprite.scale.set(1.90 * s.size, 2.86 * s.size, 1);
      const alpha = (j === count - 1 ? .55 : .12 + .19 * j / count) * gain;
      (sprite.material as THREE.SpriteMaterial).opacity = alpha;
      sprite.visible = true;
    }
    const now = samples[samples.length - 1];
    if (now.visible) {
      const main = this.sprites[start + 19];
      main.position.set(now.x, now.y, now.z);
      main.scale.set(1.90 * now.size, 2.86 * now.size, 1);
      (main.material as THREE.SpriteMaterial).opacity = .12 + gain * .78;
      main.visible = true;
    }
  }

  clearExposure() {
    this.photoWasExposing = false;
    this.hideGhosts();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  capture() {
    this.render();
    return this.renderer.domElement.toDataURL('image/jpeg', .86);
  }
}
