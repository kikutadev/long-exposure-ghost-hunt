import { GhostWorld, type GhostSample } from './world';
import './style.css';
import './polish.css';

type Phase = 'intro' | 'look' | 'opening' | 'exposing' | 'closing' | 'develop' | 'result' | 'album' | 'end';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw Error(`Missing UI element: ${selector}`);
  return element;
};

const app = $('#app');
app.innerHTML = `
<div id="game" data-phase="intro">
  <div class="letterbox-side left-side"></div><div class="letterbox-side right-side"></div>
  <main id="device">
    <canvas id="world" aria-label="Haunted classroom camera view"></canvas>
    <div class="vignette"></div><div class="grain"></div><div class="scanlines"></div>
    <div id="iris-overlay" aria-hidden="true">
      <svg id="iris" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="blade-metal" x1="0%" y1="0%" x2="90%" y2="90%"><stop offset="0" stop-color="#171d22"/><stop offset=".48" stop-color="#28313a"/><stop offset=".85" stop-color="#0c141a"/><stop offset="1" stop-color="#060b0e"/></linearGradient></defs>
        <g id="blades"></g>
      </svg>
    </div>
    <div class="cam-border" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="hud" id="hud">
      <div class="hud-top">
        <div><span class="hud-kicker">SUBJECT</span><span id="act-num" class="hud-act">01 <span>/ 03</span></span></div>
        <div class="film-progress" id="film-progress" aria-label="Collected photographs"><span></span><span></span><span></span></div>
        <button class="tiny-button" id="sound" aria-label="Toggle sound">♫</button>
      </div>
      <div class="reticle" id="reticle"><span></span><span></span><span></span><span></span><div class="reticle-dot"></div></div>
      <div class="clue" id="clue"><span class="clue-line"></span><span id="clue-label">SOMETHING MOVED...</span></div>
      <div class="signal-display" id="signal-display"><span class="signal-icon">◈</span><span id="signal-label">SPECTRAL SIGNAL</span><div class="signal-track"><div id="signal-fill"></div></div></div>
      <div class="capture-controls">
        <div class="controls-info"><span class="mono-label">EXPOSURE</span><strong id="exposure-value">0.00<span>s</span></strong></div>
        <button id="shutter" type="button" aria-label="Hold to expose and release to capture">
          <span class="shutter-ring"><span class="shutter-core"><svg viewBox="0 0 48 48"><path d="M20 7 L31 7 L39 16 L43 27 L37 37 L28 42 L16 39 L8 30 L7 20 L14 10 Z M20 7 L26 22 M39 16 L26 22 M43 27 L26 22 M37 37 L26 22 M28 42 L26 22 M16 39 L26 22 M8 30 L26 22 M7 20 L26 22 M14 10 L26 22" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></span>
        </button>
        <button id="album-button" class="album-button" aria-label="View captured photos"><span>▣</span><small>ALBUM</small></button>
      </div>
      <div class="hint" id="hint">HOLD TO EXPOSE</div>
      <div class="bottom-line">PARANORMAL CAMERA SYSTEM // 1987</div>
    </div>
    <section class="screen intro-screen" id="intro">
      <div class="intro-top"><span>FILE NO. 001</span><span>OCT. 30, 1987</span></div>
      <div class="intro-center"><div class="small-cross">✛</div><p>THE CAMERA REVEALS<br/>WHAT THE EYE CANNOT.</p><h1>LONG<br/><em>EXPOSURE</em></h1><div class="title-rule"></div><h2>GHOST HUNT</h2></div>
      <div class="intro-bottom"><p>They are moving.<br/>Only the exposure can catch them.</p><button id="start-button" class="primary-button">ENTER THE CLASSROOM <span>↗</span></button><p class="intro-foot">DRAG TO LOOK · HOLD & RELEASE TO SHOOT<br/>HEADPHONES RECOMMENDED</p></div>
    </section>
    <section class="screen result-screen hidden" id="result">
      <div class="result-head"><span id="shot-num">PHOTO 001</span><span>ANOMALY DETECTED</span></div>
      <div class="print-frame"><div class="print-photo"><img id="photo-result" alt="Captured paranormal photograph" /></div><div class="print-caption"><span>LONG EXPOSURE</span><span id="print-time">0.00s</span></div></div>
      <div class="result-bottom"><div id="result-label">TOO DARK</div><p id="result-description">The light was too faint.</p><button id="result-action" class="primary-button">RETRY <span>↗</span></button></div>
    </section>
    <section class="screen album-screen hidden" id="album"><div class="album-head"><span>PHOTO ARCHIVE</span><button id="close-album" class="outline-button">✕ CLOSE</button></div><div id="album-grid"></div></section>
    <section class="screen end-screen hidden" id="end">
      <div class="end-head">ARCHIVE COMPLETE <span>03 / 03</span></div><div class="end-title">THREE<br/>EXPOSURES.</div><div class="end-description">In every photograph, someone is looking back.</div><div id="end-photos" class="end-photos"></div><p class="end-last">YOUR CAMERA FIRES ONCE MORE.<br/>BUT YOUR FINGER IS NOT ON THE SHUTTER.</p><button id="replay" class="primary-button">REPLAY <span>↗</span></button>
    </section>
    <div id="rotate" class="rotate-screen"><div>▣</div><h2>ROTATE YOUR DEVICE</h2><p>Best experienced in portrait mode.</p></div>
    <div id="loading"><div class="load-mark">◌</div>LOADING FILM...</div>
  </main>
</div>`;

const canvas = $<HTMLCanvasElement>('#world');
const world = new GhostWorld(canvas);
const game = $('#game');
const shutter = $<HTMLButtonElement>('#shutter');
const resultPanel = $('#result');
const albumPanel = $('#album');
const endPanel = $('#end');
const hint = $('#hint');
const clue = $('#clue');
const irisOverlay = $('#iris-overlay');
const blades = $('#blades');
const NS = 'http://www.w3.org/2000/svg';
const bladeElements = Array.from({ length: 6 }, (_, i) => {
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'url(#blade-metal)');
  path.setAttribute('stroke', '#5f6970');
  path.setAttribute('stroke-width', '1.2');
  path.setAttribute('data-blade', String(i));
  blades.appendChild(path);
  return path;
});
let aperture = 1;
function drawIris(open: number) {
  aperture = clamp(open, 0, 1);
  irisOverlay.classList.toggle('active', aperture < .999);
  const inner = Math.pow(aperture, .72) * 670;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const b = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
    const at = (r: number, angle: number) => `${(200 + Math.cos(angle) * r).toFixed(2)} ${(350 + Math.sin(angle) * r).toFixed(2)}`;
    const offset = (1 - aperture) * .08;
    bladeElements[i].setAttribute('d', `M ${at(inner, a + offset)} L ${at(1300, a)} L ${at(1300, b)} L ${at(inner, b + offset)} Q ${at(inner * .95, (a+b)/2)} ${at(inner, a + offset)} Z`);
  }
}

const photos: string[] = [];
const photoTimes: number[] = [];
const history: string[] = [];
let phase: Phase = 'intro';
let act = 0;
let shots = 0;
let currentPhoto = '';
let currentResult: { quality: number; success: boolean; label: string; description: string } | null = null;
let exposureStart = 0;
let lastSample = 0;
let exposureSeconds = 0;
let samples: GhostSample[] = [];
let worldTime = 0;
let irisStart = 0;
let irisDirection: 'open'|'close'|null = null;
let phaseStarted = 0;
let pointerOwner: number | null = null;
let lookPointer: number | null = null;
let lastLookX = 0, lastLookY = 0;
let lastTime = 0;
let albumFrom: Phase = 'look';
let soundOn = true;
let lastDisturbance = -5;

class Sound {
  private ctx: AudioContext | null = null;
  private hasAmbience = false;
  start() {
    if (!soundOn) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (!this.hasAmbience) {
        this.hasAmbience = true;
        const mix = this.ctx.createGain(); mix.gain.value = .012; mix.connect(this.ctx.destination);
        for (const [freq, volume] of [[54,.62],[107,.19],[32,.26]]) {
          const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
          osc.type = freq === 32 ? 'triangle' : 'sine';
          osc.frequency.value = freq; gain.gain.value = volume;
          osc.connect(gain); gain.connect(mix); osc.start();
        }
      }
    } catch { this.ctx = null; }
  }
  pause() { if (this.ctx) void this.ctx.suspend(); }
  disturbance(act: number) {
    if (act === 0) { this.noise(.19,.008); this.tone(132,.18,.008,'triangle',107); }
    else if (act === 1) { this.tone(900,.07,.014,'sine',240); this.noise(.12,.011); }
    else { this.tone(53,.46,.025,'triangle',38); this.noise(.18,.008); }
  }
  tone(hz: number, duration: number, volume: number, type: OscillatorType = 'sine', endHz?: number) {
    if (!soundOn || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  noise(duration: number, volume: number) {
    if (!soundOn || !this.ctx) return;
    const ctx = this.ctx, len = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate), a = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 840; filter.Q.value = 1.3;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  }
  open() { this.tone(245, .11, .025, 'sawtooth', 410); this.noise(.08, .026); }
  close() { this.noise(.065, .11); this.tone(190, .08, .13, 'triangle', 47); this.tone(1320, .035, .065, 'square', 520); }
  detected() { this.tone(430, .24, .036, 'sine', 650); this.tone(880, .24, .024, 'sine', 1000); }
  miss() { this.tone(162, .24, .035, 'triangle', 94); }
  cue() { this.tone(960, .08, .011, 'sine', 530); }
}
const sound = new Sound();

function setPhase(next: Phase) { phase = next; game.dataset.phase = next; phaseStarted = performance.now() / 1000; }
function syncHUD() {
  $('#act-num').innerHTML = `0${act + 1} <span>/ 03</span>`;
  $('#film-progress').querySelectorAll('span').forEach((el, index) => el.classList.toggle('filled', index < photos.length));
  $('#clue-label').textContent = [
    'FOLLOW THE RUSTLING NOTE',
    'FOLLOW THE BRIEF FLASH',
    'SOMETHING IS GETTING CLOSER'
  ][act];
  $('#exposure-value').innerHTML = `${exposureSeconds.toFixed(2)}<span>s</span>`;
  $('#sound').textContent = soundOn ? '♫' : '♪̸';
  shutter.style.setProperty('--charge', '0turn');
}
function startGame() {
  sound.start();
  $('#intro').classList.add('hidden');
  $('#hud').classList.add('ready');
  setPhase('look');
  act = 0; shots = 0; currentResult = null; currentPhoto = ''; photos.length = 0; photoTimes.length = 0; history.length = 0;
  world.setAct(act);
  exposureSeconds = 0;
  syncHUD();
  hint.textContent = 'HOLD TO EXPOSE';
  hint.classList.remove('gone');
}
function advance() {
  if (!currentResult?.success) {
    prepareLook();
    return;
  }
  if (act === 2) {
    setPhase('end');
    resultPanel.classList.add('hidden');
    $('#hud').classList.remove('ready');
    const endPhotos = $('#end-photos');
    endPhotos.innerHTML = photos.map((url, index) => `<img src="${url}" alt="Ghost photograph ${index+1}">`).join('');
    endPanel.classList.remove('hidden');
    sound.tone(86, .55, .08, 'sine', 36);
    return;
  }
  act++;
  world.setAct(act);
  resultPanel.classList.add('hidden');
  prepareLook();
  syncHUD();
  sound.cue();
}
function prepareLook() {
  setPhase('look');
  exposureSeconds = 0;
  samples.length = 0;
  world.clearExposure();
  resultPanel.classList.add('hidden');
  $('#hud').classList.add('ready');
  shutter.classList.remove('pressed');
  drawIris(1);
  irisDirection = null;
  hint.textContent = act === 0 ? 'HOLD TO EXPOSE' : act === 1 ? 'FOLLOW THE SIGNAL' : 'DON\'T LET IT REACH YOU';
  hint.classList.remove('gone');
  $('#signal-label').textContent = 'SPECTRAL SIGNAL';
  $('#signal-fill').style.width = '0%';
  $('#signal-display').classList.remove('locked', 'danger');
  syncHUD();
}

function shotState(): { quality: number; success: boolean; label: string; description: string } {
  const level = act;
  if (!samples.length) return { quality: 0, success: false, label: 'TOO DARK', description: 'Hold a little longer to gather light.' };
  let energy = 0, blur = 0, framing = 0, seen = 0;
  let prior: { x: number; y: number } | null = null;
  const strength = [1.0, 3.4, 1.65][level];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], p = world.project(s);
    if (!p.inView) { prior = null; continue; }
    seen++;
    energy += strength / 30;
    const off = Math.hypot(p.x * .68, p.y * .55);
    framing += clamp(1.07 - off * .47, .55, 1);
    if (prior) blur += Math.hypot(p.x - prior.x, p.y - prior.y) * .50;
    prior = p;
  }
  const c = seen ? framing / seen : 0;
  const brightness = clamp(energy / .93, 0, 1);
  const blurFactor = Math.exp(-Math.pow(blur / .80, 1.2));
  const over = energy < 1.48 ? 1 : clamp(1 - (energy - 1.48) * .46, .35, 1);
  let quality = Math.round(100 * brightness * blurFactor * c * over);
  if (level === 2 && exposureSeconds > 1.65) quality = 0;
  const success = quality >= 45 && seen >= 4;
  let label = success ? (quality >= 75 ? 'CRYSTAL CLEAR' : 'GHOST CAPTURED') : 'TOO DARK';
  let description = success ? (quality >= 75 ? 'A perfect paranormal exposure.' : 'The presence is recorded.') : 'Not enough light. Hold the shutter longer.';
  if (!success && level === 2 && exposureSeconds >= 1.65) {
    label = 'TOO LATE'; description = 'It reached the lens before you let go.';
  } else if (!success && seen < 4) {
    label = 'EMPTY FRAME'; description = 'Watch for movement before exposing.';
  } else if (!success && c < .7) {
    label = 'OUT OF FRAME'; description = 'Point the camera toward the disturbance.';
  } else if (!success && blurFactor < .55) {
    label = 'TOO BLURRY'; description = 'A shorter exposure will freeze its motion.';
  } else if (!success && energy > 1.6) {
    label = 'OVEREXPOSED'; description = 'Close the shutter before the light floods in.';
  }
  return { quality, success, label, description };
}
function endExposure(forced = false) {
  if (phase !== 'opening' && phase !== 'exposing') return;
  const t = performance.now() / 1000;
  collectSamples(t, true);
  exposureSeconds = Math.max(0, t - exposureStart);
  currentResult = shotState();
  if (forced) {
    currentResult = act === 2
      ? { quality: 0, success: false, label: 'TOO LATE', description: 'The shutter slammed shut. It was too close.' }
      : { quality: 0, success: false, label: 'OVEREXPOSED', description: 'Too much light. Close the shutter sooner.' };
  }
  world.showExposure(samples, exposureSeconds);
  currentPhoto = world.capture(); // Capture the exact viewed exposure before any closing blades.
  shots++;
  history.unshift(currentPhoto);
  if (history.length > 5) history.pop();
  sound.close();
  shutter.classList.remove('pressed');
  game.classList.remove('shutter-impact');
  void game.offsetHeight;
  game.classList.add('shutter-impact');
  irisDirection = 'close'; irisStart = t;
  setPhase('closing');
  hint.classList.add('gone');
  if (currentResult.success && photos.length === act) {
    photos.push(currentPhoto);
    photoTimes.push(exposureSeconds);
  }
  syncHUD();
}

function collectSamples(t: number, final = false) {
  const maxT = Math.min(t, exposureStart + 2.4);
  while (lastSample + 1 / 30 <= maxT && samples.length < 73) {
    lastSample += 1 / 30;
    samples.push(world.positionAt(worldTime - (t - lastSample), lastSample - exposureStart));
  }
  if (final && lastSample < maxT && samples.length < 73) {
    lastSample = maxT;
    samples.push(world.positionAt(worldTime, maxT - exposureStart));
  }
}
function beginExposure(pointer: number) {
  if (phase !== 'look' || pointerOwner !== null) return;
  pointerOwner = pointer;
  sound.start(); sound.open();
  shutter.classList.add('pressed');
  $('#signal-display').classList.remove('locked','danger');
  $('#signal-label').textContent = 'SCANNING...';
  const now = performance.now() / 1000;
  exposureStart = now; lastSample = now;
  samples.length = 0;
  exposureSeconds = 0;
  irisDirection = 'open'; irisStart = now;
  drawIris(0);
  hint.classList.add('gone');
  setPhase('opening');
}

shutter.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.pointerType === 'mouse') return;
  event.preventDefault();
  if (phase !== 'look' || pointerOwner !== null) return;
  shutter.setPointerCapture(event.pointerId);
  beginExposure(event.pointerId);
});
shutter.addEventListener('pointerup', event => {
  if (pointerOwner !== event.pointerId) return;
  event.preventDefault(); pointerOwner = null;
  endExposure();
});
shutter.addEventListener('pointercancel', () => cancelInput());
shutter.addEventListener('lostpointercapture', () => {
  if (pointerOwner !== null && (phase === 'opening' || phase === 'exposing')) cancelInput();
});
canvas.addEventListener('pointerdown', event => {
  if (phase !== 'look' || lookPointer !== null) return;
  event.preventDefault(); lookPointer = event.pointerId;
  lastLookX = event.clientX; lastLookY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (lookPointer !== event.pointerId || phase !== 'look') return;
  const dx = event.clientX - lastLookX, dy = event.clientY - lastLookY;
  world.look(dx, dy);
  lastLookX = event.clientX; lastLookY = event.clientY;
});
canvas.addEventListener('pointerup', event => { if (lookPointer === event.pointerId) lookPointer = null; });
canvas.addEventListener('pointercancel', event => { if (lookPointer === event.pointerId) lookPointer = null; });
canvas.addEventListener('lostpointercapture', event => { if (lookPointer === event.pointerId) lookPointer = null; });
function cancelInput() {
  pointerOwner = null; lookPointer = null;
  if (phase === 'opening' || phase === 'exposing') {
    samples.length = 0;
    prepareLook();
  }
}
window.addEventListener('blur', () => { cancelInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelInput(); } });
window.addEventListener('orientationchange', cancelInput);
document.addEventListener('contextmenu', event => {
  if ((event.target as Element).closest('#device')) event.preventDefault();
});
$('#start-button').addEventListener('click', startGame);
$('#result-action').addEventListener('click', advance);
$('#replay').addEventListener('click', () => {
  endPanel.classList.add('hidden'); startGame();
});
$('#sound').addEventListener('click', () => { soundOn = !soundOn; if (soundOn) sound.start(); else sound.pause(); syncHUD(); });
$('#album-button').addEventListener('click', () => {
  if (phase !== 'look' || photos.length === 0) return;
  albumFrom = phase; setPhase('album'); $('#hud').classList.remove('ready');
  $('#album-grid').innerHTML = photos.map((src, i) => `<div class="archive-entry"><img src="${src}" alt="Captured ghost ${i+1}"><span>0${i+1} · ${photoTimes[i].toFixed(2)}s</span></div>`).join('');
  albumPanel.classList.remove('hidden');
});
$('#close-album').addEventListener('click', () => {
  albumPanel.classList.add('hidden');
  if (albumFrom === 'look') prepareLook();
});

function showResult() {
  world.clearExposure();
  resultPanel.classList.remove('hidden');
  $('#hud').classList.remove('ready');
  $('#photo-result').setAttribute('src', currentPhoto);
  $('#shot-num').textContent = `PHOTO ${String(shots).padStart(3,'0')}`;
  $('#print-time').textContent = `${exposureSeconds.toFixed(2)}s`;
  $('#result-label').textContent = currentResult?.label ?? 'UNKNOWN';
  $('#result-label').classList.toggle('success', !!currentResult?.success);
  $('#result-description').textContent = currentResult?.description ?? '';
  $('#result-action').innerHTML = currentResult?.success ? 'CONTINUE <span>↗</span>' : 'TRY AGAIN <span>↗</span>';
  if (currentResult?.success) sound.detected(); else sound.miss();
  setPhase('result');
}

function frame(tMs: number) {
  requestAnimationFrame(frame);
  const t = tMs / 1000;
  const dt = lastTime ? clamp(t - lastTime, 0, .06) : 0;
  lastTime = t;
  const exposing = phase === 'opening' || phase === 'exposing';
  if (phase !== 'intro' && phase !== 'result' && phase !== 'album' && phase !== 'end') {
    worldTime += dt;
  }
  world.tick(dt, worldTime, exposing, exposureSeconds);
  if (phase === 'look' && worldTime - lastDisturbance >= [6.5,2.6,4.6][act]) {
    lastDisturbance = worldTime;
    sound.disturbance(act);
  }

  if (exposing) {
    exposureSeconds = clamp(t - exposureStart, 0, 2.4);
    collectSamples(t);
    world.showExposure(samples, exposureSeconds);
    $('#exposure-value').innerHTML = `${exposureSeconds.toFixed(2)}<span>s</span>`;
    const live = shotState();
    const signal = $('#signal-display');
    const dangerous = (act === 2 && exposureSeconds > 1.15) || (act !== 2 && exposureSeconds > 1.85);
    signal.classList.toggle('locked', live.quality >= 45 && !dangerous);
    signal.classList.toggle('danger', dangerous);
    $('#signal-label').textContent = dangerous ? 'CLOSE THE SHUTTER!' : live.quality >= 75 ? 'IMAGE SHARP · RELEASE!' : live.quality >= 45 ? 'SUBJECT VISIBLE · RELEASE' : live.label === 'EMPTY FRAME' ? 'SEARCHING FOR PRESENCE' : 'FORMING IMAGE...';
    $('#signal-fill').style.width = String(clamp(live.quality, 0, 100)) + '%';
    shutter.style.setProperty('--charge', String(clamp(live.quality / 100, 0, 1)) + 'turn');
    if (phase === 'opening' && t - irisStart > .12) setPhase('exposing');
    if (exposureSeconds >= (act === 2 ? 1.65 : 2.4)) endExposure(true);
  }
  if (irisDirection === 'open') {
    const v = clamp((t - irisStart) / .12, 0, 1);
    drawIris(1 - Math.pow(1 - v, 2.3));
    if (v === 1) irisDirection = null;
  }
  if (irisDirection === 'close') {
    const v = clamp((t - irisStart) / .09, 0, 1);
    drawIris(1 - Math.pow(v, 1.8));
    if (v === 1) {
      irisDirection = null;
      if (phase === 'closing') setPhase('develop');
    }
  }
  if (phase === 'develop' && t - phaseStarted > .16) {
    showResult(); drawIris(1);
  }
  world.render();
}
window.addEventListener('resize', () => world.updateViewport());
async function boot() {
  try {
    await world.load();
    $('#loading').classList.add('hidden');
    world.setAct(0);
    syncHUD(); drawIris(1);
    requestAnimationFrame(frame);
  } catch (error) {
    $('#loading').innerHTML = `CAMERA ERROR<br/><small>${String(error)}</small>`;
    console.error(error);
  }
}
void boot();

// Test-only read access to player state (no cheats or public API).
Object.defineProperty(window, '__longExposureState', {
  get: () => ({ phase, act, photos: photos.length, shots, exposureSeconds, quality: currentResult?.quality, label: currentResult?.label })
});
