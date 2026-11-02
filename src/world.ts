import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decorateClassroom } from './atmosphere';
import { formExposure, type DeathCause } from './shot';
import { RiveGhost } from './rive-ghost';
import { nearGhostSample, PHOTOGRAPHER_POSITION } from './near-ghost-motion';

export type GhostSample = { t: number; x: number; y: number; z: number; visible: boolean; size: number };
const fixed = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function box(scene: THREE.Object3D, size: [number, number, number], at: [number, number, number], color: number, rough = .9) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  mesh.position.set(...at);
  scene.add(mesh);
  return mesh;
}
function plank(scene: THREE.Object3D, from: [number, number, number], to: [number, number, number], thickness: number, color: number) {
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
  private nearGhost = new RiveGhost();
  private nearGhostEnabled = false;
  private nearPoseSprites: THREE.Sprite[] = [];
  private fastPoseTextures: THREE.Texture[] = [];
  private fastHeadOnTexture!: THREE.Texture;
  private baseNoticedSprite: THREE.Sprite | null = null;
  private recognizedAt: number | null = null;
  private flicker: THREE.PointLight;
  private frontFluorescent!: THREE.MeshStandardMaterial;
  private book: THREE.Mesh;
  private shiftingChairs: { mesh: THREE.Group; x: number; z: number }[] = [];
  private oldClock: THREE.Object3D[] = [];
  private turningPage: THREE.Object3D | null = null;
  private pageMixer: THREE.AnimationMixer | null = null;
  private pageClipDuration = 0;
  private animatedChairs: { x: number; z: number; mixer: THREE.AnimationMixer; duration: number }[] = [];
  private photoWasExposing = false;
  private curtain: THREE.Mesh;
  private atmosphere: ReturnType<typeof decorateClassroom>;
  private filmBleach = { value: 0 };
  private viewportW = 1;
  private viewportH = 1;
  private fatal: {cause: DeathCause; origin: THREE.Vector3; quaternion: THREE.Quaternion; ghostZ: number} | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x080f12);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.36;
    this.scene.background = new THREE.Color(0x10181b);
    this.scene.fog = new THREE.FogExp2(0x10191b, .024);
    this.camera.position.set(PHOTOGRAPHER_POSITION.x, PHOTOGRAPHER_POSITION.y, PHOTOGRAPHER_POSITION.z);
    this.pointAtYaw();
    this.buildRoom();
    this.atmosphere = decorateClassroom(this.scene);

    this.flicker = new THREE.PointLight(0xccefdc, 11, 12, 2);
    this.flicker.position.set(0, 3.0, -3);
    this.scene.add(this.flicker);
    this.book = box(this.scene, [.45, .018, .30], [-.84, .74, -4.9], 0x96917a);
    this.book.rotation.y = -.5;
    this.curtain = box(this.scene, [.02, 3.4, 4.5], [-4.97, 1.8, -3.5], 0x20343a);
    this.curtain.visible = true;
  }

  async load() {
    const loader = new THREE.TextureLoader();
    const names = ['ghost-base-reading.webp', 'ghost-fast-launch.webp', 'ghost-near.png'];
    this.textures = await Promise.all(names.map(n => loader.loadAsync(`${import.meta.env.BASE_URL}assets/${n}`)));
    const poseTextures = await Promise.all(['recognition', 'attack'].map(
      pose => loader.loadAsync(`${import.meta.env.BASE_URL}assets/ghost-near-${pose}.webp`)
    ));
    this.fastPoseTextures = [this.textures[1],
      await loader.loadAsync(`${import.meta.env.BASE_URL}assets/ghost-fast-stride.webp`)];
    this.fastPoseTextures.forEach(texture => { texture.colorSpace = THREE.SRGBColorSpace; });
    this.fastHeadOnTexture = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/ghost-fast.png`);
    this.fastHeadOnTexture.colorSpace = THREE.SRGBColorSpace;
    const noticedTexture = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/ghost-base-noticed.webp`);
    noticedTexture.colorSpace = THREE.SRGBColorSpace;
    try {
      await this.nearGhost.load(import.meta.env.BASE_URL + 'assets/ghost-near.riv');
      this.nearGhostEnabled = true;
    } catch (error) {
      // Unsupported WASM/device must not trap the player on the loading screen.
      console.warn('Rive ghost unavailable; using original photograph.', error);
    }
    try {
      const dress = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'assets/classroom-dress.glb');
      this.scene.add(dress.scene);
      this.book.visible = false;
      this.oldClock.forEach(node => { node.visible = false; });
      this.turningPage = dress.scene.getObjectByName('BOOK_Page_Turning') ?? null;
      const flip = dress.animations.find(clip => clip.name === 'AN_Notebook_Flip');
      if (flip && this.turningPage) {
        this.pageMixer = new THREE.AnimationMixer(dress.scene);
        this.pageMixer.clipAction(flip).play();
        this.pageClipDuration = flip.duration;
      }
      const template = dress.scene.getObjectByName('HAUNT_Chair');
      const scrape = dress.animations.find(clip => clip.name === 'AN_Chair_Scrape');
      if (template && scrape) {
        // Keep the Blender node as a clone source; selected Three.js fallback chairs
        // become invisible only after the animated replacements exist.
        template.visible = false;
        for (const chair of this.shiftingChairs) {
          const model = template.clone(true);
          // Keep world placement on an unanimated parent. The Blender clip's
          // root-motion position belongs to the child and must not overwrite it.
          const anchor = new THREE.Group();
          anchor.position.set(chair.x, 0, chair.z);
          model.visible = true;
          anchor.add(model);
          this.scene.add(anchor);
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(scrape).play();
          this.animatedChairs.push({ x: chair.x, z: chair.z, mixer, duration: scrape.duration });
          chair.mesh.visible = false;
        }
      }
    } catch (error) {
      console.warn('Blender props unavailable, using basic props', error);
    }
    this.textures.forEach(t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    });
    for (let act = 0; act < 3; act++) {
      for (let i = 0; i < 6; i++) {
        const texture = act === 2 && i === 0 && this.nearGhostEnabled ? this.nearGhost.texture : this.textures[act];
        const sprite = this.makeGhostSprite(texture);
        if (act === 2 && i === 0) sprite.renderOrder = 10;
        this.sprites.push(sprite);
      }
    }
    this.baseNoticedSprite = this.makeGhostSprite(noticedTexture);
    this.baseNoticedSprite.renderOrder = 11;
    this.nearPoseSprites = poseTextures.map(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = this.makeGhostSprite(texture);
      sprite.renderOrder = 11;
      return sprite;
    });
    this.nearGhost.reset();
    this.updateViewport();
  }

  /** The figure's feet change position in source art, so every accumulated
   * exposure sample must use its own pose rather than one live global frame. */
  private fastPoseAt(time: number, sample: GhostSample): THREE.Texture {
    // When the shutter is left open, the fleeing figure's return route
    // bends through the camera. The existing frontal running keyframe makes
    // that change of trajectory visible without pretending it looks back.
    if (sample.z > -4.4) return this.fastHeadOnTexture;
    const phase = ((time + .15) % 2.6 + 2.6) % 2.6;
    const u = fixed((phase - .30) / 1.08, 0, 1);
    return this.fastPoseTextures[(Math.floor(u * 3.7) % 2)];
  }

  private makeGhostSprite(texture: THREE.Texture): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: texture, transparent: true, opacity: 0,
      depthWrite: false, depthTest: true, color: 0xe4ded7, toneMapped: false
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.filmBleach = this.filmBleach;
      shader.fragmentShader = 'uniform float filmBleach;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n float filmGray = dot(diffuseColor.rgb, vec3(.299, .587, .114));\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(filmGray), .88);\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), filmBleach);');
    };
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.scale.set(1.90, 2.86, 1);
    this.scene.add(sprite);
    return sprite;
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
      const chair = new THREE.Group();
      sc.add(chair);
      box(chair, [1.1, .48, .05], [x, 1.18, z + .85], 0x635543);
      box(chair, [.10, .55, .08], [x - .5, .59, z + .75], 0x474438);
      box(chair, [.10, .55, .08], [x + .5, .59, z + .75], 0x474438);
      this.shiftingChairs.push({ mesh: chair, x, z });
    }
    box(sc, [1.0, .045, .6], [2.8, .92, -5.6], 0x493e31);
    box(sc, [1.3, 1.7, .1], [-4.6, 1.7, -6.8], 0x7b6955);
    box(sc, [1.08, 1.32, .12], [-4.55, 1.78, -6.8], 0x373b37);
    box(sc, [.13, .13, .06], [-4.51, 1.69, -6.72], 0xaca490);
    const circle = new THREE.Mesh(new THREE.RingGeometry(.21, .25, 32), new THREE.MeshBasicMaterial({ color: 0xb4b7a4 }));
    circle.position.set(3.8, 2.65, -8.23); sc.add(circle);
    this.oldClock.push(circle);
    this.oldClock.push(plank(sc, [3.8, 2.65, -8.2], [3.8, 2.75, -8.19], .008, 0xc9cfca));
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
    this.resetFatal();
    this.act = act;
    // The opening photograph is composed on the notebook, not across an
    // empty classroom. Later stages retain their broad view for tracking.
    this.camera.fov = act === 0 ? 48 : 62;
    this.camera.updateProjectionMatrix();
    this.recognizedAt = null;
    this.nearGhost.reset();
    this.yaw = act === 1 ? -.13 : act === 2 ? 0 : -.07;
    this.pitch = -.025;
    this.pointAtYaw();
    this.hideGhosts();
  }

  resetObservation() { this.recognizedAt = null; }

  recognizeAt(exposureAge: number) {
    if (this.act !== 2 || this.recognizedAt !== null) return false;
    this.recognizedAt = exposureAge;
    return true;
  }

  get observationAge() { return this.recognizedAt; }

  positionAt(t: number, exposureAge = 0): GhostSample {
    const a = this.act;
    if (a === 0) {
      // The hand stays by the page; a tiny recoil accompanies the sudden gaze.
      // The actual pose change is an authored image, not an arbitrary PNG slide.
      const jerk = fixed((exposureAge - .60) / .07, 0, 1);
      return {
        t, x: -.86 + .035 * jerk,
        y: 1.55 + .015 * jerk,
        z: -4.55,
        visible: true, size: 1.16
      };
    }
    if (a === 1) {
      const phase = ((t + .15) % 2.6 + 2.6) % 2.6;
      // The chairs move first. A short, readable pass follows the physical cue.
      const active = phase >= .30 && phase < 1.38;
      const u = fixed((phase - .30) / 1.08, 0, 1);
      // Hesitate at the window, burst across the desks, then disappear by the door.
      const pos = u < .19 ? u / .19 * .10
        : u < .78 ? .10 + (u - .19) / .59 * .82
        : .92 + (u - .78) / .22 * .08;
      if (exposureAge >= 1.62) {
        const turn = fixed((exposureAge - 1.62) / .78, 0, 1);
        const dash = Math.pow(turn, 1.45);
        // It was trying to reach the door, not the photographer. The open
        // shutter changes its route; the collision, not film damage, is fatal.
        return { t, x: -1.75 * (1 - dash), y: 1.50, z: -4.45 + 9.25 * dash,
          visible: true, size: 1.07 };
      }
      return { t, x: 1.75 - pos * 3.50, y: 1.50 + .025 * Math.sin(t * 18), z: -4.45, visible: active, size: 1.20 };
    }
    return nearGhostSample(t, exposureAge, this.recognizedAt);
  }

  project(sample: GhostSample) {
    this.camera.updateMatrixWorld();
    const view = new THREE.Vector3(sample.x, sample.y, sample.z).applyMatrix4(this.camera.matrixWorldInverse);
    const ndc = new THREE.Vector3(sample.x, sample.y, sample.z).project(this.camera);
    // The PNG's translucent margins occupy about 20% on each side.
    const crossingSideways = this.act === 1 && sample.z <= -4.4;
    const spriteW = crossingSideways ? 3.0 : 1.90;
    const spriteH = crossingSideways ? 2.80 : 2.86;
    const height = spriteH * sample.size * .8 / Math.max(.1, -view.z) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const width = height * (spriteW / spriteH) * .75 / this.camera.aspect;
    const overlapX = Math.max(0, Math.min(1, ndc.x + width / 2) - Math.max(-1, ndc.x - width / 2));
    const overlapY = Math.max(0, Math.min(1, ndc.y + height / 2) - Math.max(-1, ndc.y - height / 2));
    const coverage = overlapX * overlapY / (width * height);
    return { x: ndc.x, y: ndc.y, width, height, coverage,
      inView: sample.visible && view.z < 0 && ndc.z >= -1 && ndc.z <= 1 && coverage > 0 };
  }

  tick(dt: number, time: number, exposing: boolean, exposureAge = 0) {
    const glitch = (Math.sin(time * 5.2) + Math.sin(time * 12.7) * .4) * .09;
    // Brief dips create a perceptible silence/impact pair. They use the same
    // exposure clock as the ghost; no unrelated fullscreen flashes.
    const firstDip = exposing && this.act === 0 && exposureAge >= .54 && exposureAge < .61;
    const fastSample = this.act === 1 ? this.positionAt(time, exposureAge) : null;
    const fastDip = exposing && fastSample?.visible && Math.abs(fastSample.x) < .55;
    const nearSample = this.act === 2 && exposing ? this.positionAt(time, exposureAge) : null;
    const watching = this.recognizedAt !== null && exposing && this.act === 2;
    const heldBreath = watching && exposureAge - this.recognizedAt! < .20;
    const nearDip = nearSample && !nearSample.visible;
    const dim = firstDip ? .46 : fastDip ? .62 : nearDip ? .23 : heldBreath ? .72 : 1;
    this.flicker.intensity = ((this.act === 2 ? 2.2 : 5) + glitch) * dim;
    this.frontFluorescent.emissiveIntensity = Math.max(.03,
      ((this.act === 2 ? .24 : .68) + Math.max(0, glitch)) * dim);
    // bpy-authored motion clips. Three.js only chooses WHEN a physical event happens.
    // Local time is stable across replays and is coupled to the ghost's crossing.
    const pageCycle = ((time - .55) % 4.1 + 4.1) % 4.1;
    if (this.pageMixer) {
      // Freeze the sheet in the air just after the apparition looks up.
      // The physical impossibility is the reveal, rather than a screen flash.
      this.pageMixer.setTime(this.act === 0 ? Math.min(exposing ? Math.min(exposureAge, .75) : pageCycle, this.pageClipDuration) : 0);
    } else {
      // Fallback if the glTF clip is absent: keep the experience playable.
      this.book.rotation.z = this.act === 0 ? Math.sin((exposing ? exposureAge : time) * 2.3) * .04 : 0;
    }
    if (this.animatedChairs.length) {
      for (const chair of this.animatedChairs) {
        let elapsed = -1;
        if (this.act === 0 && chair.x === -2.6 && chair.z === -3.25) {
          elapsed = (exposing ? exposureAge : pageCycle) - 1.04;
        } else if (this.act === 1 && chair.z === -3.25) {
          const pass = ((time + .15) % 2.6 + 2.6) % 2.6;
          elapsed = pass - ((2.6 - chair.x) / 5.2) * 1.05;
        } else if (this.act === 2 && chair.x === 0) {
          const idlePulse = ((time + .2) % 4.1 + 4.1) % 4.1;
          // Only the far chair stirs while idle; the approach starts on shutter press.
          const cueAge = exposing ? exposureAge
            : (chair.z === -5.7 && idlePulse > 2.8 ? Math.min(.44, (idlePulse - 2.8) * .65) : 0);
          const cueOffset = chair.z === -5.7 ? .25 : chair.z === -3.25 ? .73 : 1.16;
          // The far chair warns before recognition. The next two jolt as the
          // ghost acknowledges the lens and materializes closer to the player.
          elapsed = exposing && this.recognizedAt !== null && chair.z !== -5.7
            ? exposureAge - this.recognizedAt - (chair.z === -3.25 ? .04 : .27)
            : cueAge - cueOffset;
        }
        chair.mixer.setTime(Math.max(0, Math.min(chair.duration, elapsed)));
      }
    } else {
      // Static fallback for older/missing GLBs. It must not compete with the clips.
      this.shiftingChairs.forEach(({ mesh, x, z }) => {
        const cue = ((time + .15) % 2.6 + 2.6) % 2.6;
        const shift = this.act === 0 && x === -2.6 && z === -3.25
          ? Math.max(0, Math.sin(time * 2)) * .15
          : this.act === 1 && z === -3.25 && cue >= (2.6 - x) / 5.2
            ? .12 : 0;
        mesh.position.x = shift;
      });
    }
    const pos = this.positionAt(time, exposureAge);
    this.atmosphere.update(time, this.act, exposing, new THREE.Vector3(pos.x, pos.y, pos.z), exposureAge);
    const curtainCue = ((time + .15) % 2.6 + 2.6) % 2.6;
    this.curtain.position.z = -3.5 + (this.act === 1 && curtainCue > 2.25 ? -.22 * Math.sin((curtainCue - 2.25) / .35 * Math.PI) : 0);
    if (!exposing && this.photoWasExposing) { this.hideGhosts(); this.photoWasExposing = false; }
  }

  hideGhosts() { this.sprites.forEach(s => { s.visible = false; }); this.nearPoseSprites.forEach(s => { s.visible = false; }); if (this.baseNoticedSprite) this.baseNoticedSprite.visible = false; }

  showExposure(samples: GhostSample[], exposureSeconds: number, frozenPhoto = false) {
    this.photoWasExposing = true;
    this.hideGhosts();
    if (!samples.length) return;
    const film = formExposure(samples, this.act, exposureSeconds, s => this.project(s));
    // Act 3's danger is distance, not film bleaching. Keep the face and
    // reaching hand legible even when the accumulated density is high.
    this.filmBleach.value = this.act === 2 ? Math.min(.19, film.bleach * .18)
      : this.act === 1 ? (exposureSeconds >= 1.62 ? Math.min(.14, film.bleach * .16) : Math.min(.43, film.bleach * .43))
      : Math.min(.34, film.bleach * .36);
    const total = film.weights.reduce((sum, weight) => sum + weight, 0);
    if (!total) return;
    // One readable human figure, with a few faint positional echoes.
    // Do not convert the ghost into a glowing cloud of repeated silhouettes.
    // Success-grade negatives are immediately legible, not translucent
    // silhouettes that the result screen inexplicably calls captured.
    const strength = Math.pow(film.density, .72) * 1.25 * (1 - film.bleach * .6);
    let mid = 0, accumulated = 0;
    for (let i = 0; i < film.weights.length; i++) {
      accumulated += film.weights[i];
      if (accumulated >= total / 2) { mid = i; break; }
    }
    // Act 2 is a brief crossing. Pick the best *actually exposed* frame for
    // the primary silhouette, rather than a half-clipped weighted midpoint.
    // The old samples still form the blur/afterimage and quality calculation.
    if (this.act === 1 && exposureSeconds >= 1.62) {
      // Preserve the last visible frame of the oncoming figure: the danger
      // must be visible before collision, not buried behind an earlier pass.
      mid = samples.length - 1;
    } else if (this.act === 1) {
      let bestScore = -1;
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (!sample.visible || film.weights[i] <= 0) continue;
        const projection = this.project(sample);
        if (!projection.inView) continue;
        const score = (projection.coverage ?? 0) * (1 - .45 * Math.min(1, Math.abs(projection.x)));
        if (score > bestScore) { bestScore = score; mid = i; }
      }
    }
    // The near spirit must actually advance toward the lens.
    if (this.act === 2) mid = samples.length - 1;
    let primary = samples[mid];
    // While watching, the two disappearances are truly blank. On film, an
    // exposure still retains the last visible silhouette, even if the shutter
    // closes in the 40ms gap between sightings.
    if (this.act === 2 && !primary.visible) {
      if (!frozenPhoto) return;
      const lastVisible = [...samples].reverse().find(sample => sample.visible);
      if (!lastVisible) return;
      primary = lastVisible;
      mid = samples.lastIndexOf(lastVisible);
    }
    const main = this.sprites[this.act * 6];
    main.position.set(primary.x, primary.y, primary.z);
    const runningAtLens = this.act === 1 && primary.z > -4.4;
    main.scale.set((runningAtLens ? 1.90 : this.act === 1 ? 3.0 : 1.90) * primary.size,
      (runningAtLens ? 2.86 : this.act === 1 ? 2.80 : 2.86) * primary.size, 1);
    if (this.act === 1) (main.material as THREE.SpriteMaterial).map = this.fastPoseAt(primary.t, primary);
    // Once the presence notices the lens it becomes less spectral and more
    // physically threatening. The safe ~0.7s exposure is unaffected.
    const imminent = this.act === 2 ? Math.pow(fixed((exposureSeconds - 1.08) / .5, 0, 1), 1.5) : 0;
    const opacity = Math.min(.98, strength * (this.act === 1 ? 1.16 : .9) + imminent * .36);
    if (this.act === 0 && this.baseNoticedSprite) {
      // The page turns before the head rises. The body remains pinned beside
      // the notebook, while the face changes from downcast to direct eye contact.
      const noticed = fixed((exposureSeconds - .61) / .09, 0, 1);
      this.baseNoticedSprite.position.copy(main.position);
      this.baseNoticedSprite.scale.copy(main.scale);
      (this.baseNoticedSprite.material as THREE.SpriteMaterial).opacity = opacity * noticed;
      this.baseNoticedSprite.visible = primary.visible && noticed > 0;
      (main.material as THREE.SpriteMaterial).opacity = opacity * (1 - noticed);
      main.visible = primary.visible && noticed < 1;
    } else if (this.act === 2 && this.recognizedAt !== null) {
      // Distinct camera-facing poses are essential: geometry-free Rive warping
      // cannot invent a new face angle or realistic foreshortened fingers.
      const reaction = exposureSeconds - this.recognizedAt;
      const seen = fixed(reaction / .12, 0, 1);
      const strike = fixed((reaction - .31) / .13, 0, 1);
      (main.material as THREE.SpriteMaterial).opacity = opacity * (1 - seen);
      main.visible = primary.visible && seen < 1;
      const [recognition, attack] = this.nearPoseSprites;
      for (const sprite of [recognition, attack]) {
        sprite.position.copy(main.position);
        sprite.scale.copy(main.scale);
      }
      // The enlarged palm sits high in the portrait. Shift the attack pose
      // below the eye line so its HAND, not its knees, approaches the lens.
      attack.position.y -= .72 * strike;
      (recognition.material as THREE.SpriteMaterial).opacity = opacity * seen * (1 - strike);
      (attack.material as THREE.SpriteMaterial).opacity = opacity * seen * strike;
      recognition.visible = primary.visible && seen > 0 && strike < 1;
      attack.visible = primary.visible && strike > 0;
    } else {
      (main.material as THREE.SpriteMaterial).opacity = opacity;
      main.visible = primary.visible;
    }
    if (this.act === 2) this.nearGhost.renderAt(this.recognizedAt === null ? Math.min(exposureSeconds,.5) : Math.min(1.65,.5 + Math.max(0,exposureSeconds - this.recognizedAt) * 2.1));

    // Only moving ghosts leave a noticeable trail; ghosts that stand still
    // become clearer rather than appearing as an opaque luminous blob.
    const motion = 1 - film.sharpness;
    const trailStrength = Math.min(.12, .035 + motion * .13) * strength;
    for (let j = 0; j < 5; j++) {
      const index = Math.min(samples.length - 1, Math.floor((j + .5) * samples.length / 5));
      const sample = samples[index], projection = this.project(sample);
      const sprite = this.sprites[this.act * 6 + j + 1];
      if (!projection.inView || Math.abs(index - mid) < 2) continue;
      sprite.position.set(sample.x, sample.y, sample.z);
      const closePass = this.act === 1 && sample.z > -4.4;
      sprite.scale.set((closePass ? 1.90 : this.act === 1 ? 3.0 : 1.90) * sample.size,
        (closePass ? 2.86 : this.act === 1 ? 2.80 : 2.86) * sample.size, 1);
      if (this.act === 1) (sprite.material as THREE.SpriteMaterial).map = this.fastPoseAt(sample.t, sample);
      (sprite.material as THREE.SpriteMaterial).opacity = trailStrength * (film.weights[index] > 0 ? 1 : 0);
      sprite.visible = film.weights[index] > 0;
    }
  }

  clearExposure() {
    this.photoWasExposing = false;
    this.hideGhosts();
  }

  beginFatal(cause: DeathCause) {
    const main = this.sprites[this.act * 6];
    this.fatal = {
      cause,
      origin: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      ghostZ: main.position.z,
    };
  }

  renderFatal(elapsed: number, reducedMotion: boolean) {
    if (!this.fatal) return;
    const progress = fixed(elapsed / .82, 0, 1);
    const rush = 1 - Math.pow(1 - progress, 3);
    this.camera.position.copy(this.fatal.origin);
    this.camera.quaternion.copy(this.fatal.quaternion);
    if (this.fatal.cause === 'RUN_THROUGH') {
      // The runner is not attacking. The open shutter has bent its escape
      // route directly through the operator. First show the imminent body,
      // then let the impact actually knock the camera toward the floor.
      const runner = this.sprites[6];
      const impact = fixed(elapsed / .18, 0, 1);
      const fall = fixed((elapsed - .20) / .52, 0, 1);
      const fallEase = fall * fall * (3 - 2 * fall);
      (runner.material as THREE.SpriteMaterial).map = this.fastHeadOnTexture;
      (runner.material as THREE.SpriteMaterial).opacity = .98 * (1 - fixed((elapsed - .23) / .22, 0, 1));
      runner.visible = elapsed < .45;
      runner.position.set(0, 1.15 - .18 * impact, this.fatal.ghostZ + .30 * impact);
      runner.scale.set(1.9, 2.86, 1);
      this.filmBleach.value = .12 + impact * .08;
      if (!reducedMotion) {
        this.camera.position.y -= .95 * fallEase;
        this.camera.position.x -= .32 * fallEase;
        this.camera.position.z -= .18 * fallEase;
        this.camera.rotateZ(.43 * fallEase);
        this.camera.rotateX(-.20 * fallEase);
      }
    } else if (this.fatal.cause === 'TOO CLOSE') {
      // The physical attack frame persists during impact. Its foreshortened
      // fingers, rather than a scaled idle sprite, rush into the lens.
      const idle = this.sprites[2 * 6];
      idle.visible = false;
      this.nearPoseSprites[0].visible = false;
      const attack = this.nearPoseSprites[1];
      const grab = fixed(elapsed / .24, 0, 1);
      const fall = fixed((elapsed - .24) / .52, 0, 1);
      const fallEase = fall * fall * (3 - 2 * fall);
      // Keep the hand and stare framed for the first quarter-second.
      attack.visible = elapsed < .55;
      (attack.material as THREE.SpriteMaterial).opacity = .98 * (1 - fixed((elapsed - .38) / .17, 0, 1));
      attack.position.copy(idle.position);
      attack.position.y -= .76;
      attack.position.z = this.fatal.ghostZ + .22 * grab;
      attack.scale.copy(idle.scale);
      attack.scale.multiplyScalar(1 + .11 * grab);
      // Only after contact does the camera topple toward the floor.
      if (!reducedMotion) {
        this.camera.position.y -= 1.05 * fallEase;
        this.camera.position.x += .36 * fallEase;
        this.camera.position.z += .24 * fallEase;
        this.camera.rotateZ(-.34 * fallEase);
        this.camera.rotateX(-.18 * fallEase);
      }
    } else {
      // A corrupted exposure reverses the camera/subject relationship.
      this.filmBleach.value = Math.min(1, .22 + rush * .74);
      const main = this.sprites[this.act * 6];
      main.position.z = this.fatal.ghostZ + 5.6 * rush;
      if (!reducedMotion) this.camera.rotateZ(.045 * Math.sin(progress * 22) * (1-progress));
    }
    this.render();
  }

  resetFatal() {
    this.fatal = null;
    this.camera.position.set(PHOTOGRAPHER_POSITION.x, PHOTOGRAPHER_POSITION.y, PHOTOGRAPHER_POSITION.z);
    this.pointAtYaw();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  capture() {
    this.render();
    const source = this.renderer.domElement;
    const photo = document.createElement('canvas');
    const ratio = Math.min(1, 960 / source.height);
    photo.width = Math.round(source.width * ratio); photo.height = Math.round(source.height * ratio);
    photo.getContext('2d')!.drawImage(source, 0, 0, photo.width, photo.height);
    return photo.toDataURL('image/jpeg', .88);
  }
}