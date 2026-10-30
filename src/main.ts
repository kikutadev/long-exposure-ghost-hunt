import { GhostWorld, type GhostSample } from './world';
import './style.css';
import './polish.css';
import { GAME_MARKUP } from './view';
import { Sound } from './audio';
import { ShutterIris } from './iris';
import { evaluateShot, type ShotResult } from './shot';
import { bindCameraInput } from './input';

type Phase = 'intro' | 'look' | 'opening' | 'exposing' | 'closing' | 'develop' | 'result' | 'album' | 'end';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw Error(`Missing UI element: ${selector}`);
  return element;
};

$('#app').innerHTML = GAME_MARKUP;

const canvas = $<HTMLCanvasElement>('#world');
const world = new GhostWorld(canvas);
const game = $('#game');
const shutter = $<HTMLButtonElement>('#shutter');
const resultPanel = $('#result');
const albumPanel = $('#album');
const endPanel = $('#end');
const hint = $('#hint');
const iris = new ShutterIris($('#iris-overlay'), $('#blades'));

const photos: string[] = [];
const photoTimes: number[] = [];
const history: string[] = [];
let phase: Phase = 'intro';
let act = 0;
let shots = 0;
let currentPhoto = '';
let currentResult: ShotResult | null = null;
let exposureStart = 0;
let lastSample = 0;
let exposureSeconds = 0;
let samples: GhostSample[] = [];
let worldTime = 0;
let irisStart = 0;
let irisDirection: 'open'|'close'|null = null;
let phaseStarted = 0;
let lastTime = 0;
let albumFrom: Phase = 'look';
let lastDisturbance = -5;


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
  $('#sound').textContent = sound.isEnabled ? '♫' : '♪̸';
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
  iris.draw(1);
  irisDirection = null;
  hint.textContent = act === 0 ? 'HOLD TO EXPOSE' : act === 1 ? 'FOLLOW THE SIGNAL' : 'DON\'T LET IT REACH YOU';
  hint.classList.remove('gone');
  $('#signal-label').textContent = 'SPECTRAL SIGNAL';
  $('#signal-fill').style.width = '0%';
  $('#signal-display').classList.remove('locked', 'danger');
  syncHUD();
}

const shotState = () => evaluateShot(samples, act, exposureSeconds, sample => world.project(sample));

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
function beginExposure() {
  if (phase !== 'look') return;
  sound.start(); sound.open();
  shutter.classList.add('pressed');
  $('#signal-display').classList.remove('locked','danger');
  $('#signal-label').textContent = 'SCANNING...';
  const now = performance.now() / 1000;
  exposureStart = now; lastSample = now;
  samples.length = 0;
  exposureSeconds = 0;
  irisDirection = 'open'; irisStart = now;
  iris.draw(0);
  hint.classList.add('gone');
  setPhase('opening');
}

bindCameraInput(canvas, shutter, {
  canLook: () => phase === 'look',
  canShoot: () => phase === 'look',
  look: (dx, dy) => world.look(dx, dy),
  shootStart: beginExposure,
  shootEnd: () => endExposure(),
  cancelExposure: () => {
    if (phase === 'opening' || phase === 'exposing') {
      samples.length = 0;
      prepareLook();
    }
  }
});
$('#start-button').addEventListener('click', startGame);
$('#result-action').addEventListener('click', advance);
$('#replay').addEventListener('click', () => {
  endPanel.classList.add('hidden'); startGame();
});
$('#sound').addEventListener('click', () => { sound.toggle(); syncHUD(); });
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
    iris.draw(1 - Math.pow(1 - v, 2.3));
    if (v === 1) irisDirection = null;
  }
  if (irisDirection === 'close') {
    const v = clamp((t - irisStart) / .09, 0, 1);
    iris.draw(1 - Math.pow(v, 1.8));
    if (v === 1) {
      irisDirection = null;
      if (phase === 'closing') setPhase('develop');
    }
  }
  if (phase === 'develop' && t - phaseStarted > .16) {
    showResult(); iris.draw(1);
  }
  world.render();
}
window.addEventListener('resize', () => world.updateViewport());
async function boot() {
  try {
    await world.load();
    $('#loading').classList.add('hidden');
    world.setAct(0);
    syncHUD(); iris.draw(1);
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
