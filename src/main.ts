import { GhostWorld } from './world';
import './style.css';
import './polish.css';
import './death.css';
import { GAME_MARKUP } from './view';
import { Sound } from './audio';
import { ShutterIris } from './iris';
import { evaluateShot, assessFatalExposure, exposureLimit, type DeathCause, type ShotResult } from './shot';
import { bindCameraInput } from './input';
import { ExposureSession } from './exposure-session';
import { DeathScreen } from './death-screen';

type Phase = 'intro' | 'look' | 'opening' | 'exposing' | 'closing' | 'develop' | 'result' | 'album' | 'end' | 'dying' | 'dead';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw Error(`Missing UI element: ${selector}`);
  return element;
};

$('#app').innerHTML = GAME_MARKUP;
// The old score meter is absent from both the visible UI and accessibility tree.
document.querySelector('.signal-track')?.remove();
document.querySelector('.signal-icon')?.remove();

const canvas = $<HTMLCanvasElement>('#world');
const world = new GhostWorld(canvas);
const game = $('#game');
const shutter = $<HTMLButtonElement>('#shutter');
const resultPanel = $('#result');
const albumPanel = $('#album');
const endPanel = $('#end');
const deathPanel = $('#death');
const deathScreen = new DeathScreen(deathPanel, import.meta.env.BASE_URL);
const capture = new ExposureSession();
const hint = $('#hint');
const iris = new ShutterIris($('#iris-overlay'), $('#blades'));

const photos: string[] = [];
const photoTimes: number[] = [];
const history: string[] = [];
let phase: Phase = 'intro';
let act = 0;
let shots = 0;
let currentPhoto = '';
let deathCause: DeathCause | null = null;
let currentResult: ShotResult | null = null;
let irisOpen = 1;
let irisCloseFrom = 1;
let endingClick = false;
let exposureSeconds = 0;
let worldTime = 0;
let irisStart = 0;
let irisDirection: 'open'|'close'|null = null;
let phaseStarted = 0;
let lastTime = 0;
let albumFrom: Phase = 'look';
let lastDisturbance = -5;
let lastFastCue = -1;
let lastPaperCycle = -1;
let lastChairCycle = -1;


const sound = new Sound();
const RECORDS = [
  { name: 'THE ONE WHO WAITS', note: 'The notebook keeps turning. Nobody is there.' },
  { name: 'THE ONE WHO RUNS', note: 'The chairs move toward the door. It never opens.' },
  { name: 'THE ONE WHO WATCHES', note: 'It moves closer when the shutter is open.' }
] as const;

function setPhase(next: Phase) { phase = next; game.dataset.phase = next; phaseStarted = performance.now() / 1000; }
function syncHUD() {
  $('#act-num').innerHTML = `0${act + 1} <span>/ 03</span>`;
  $('#film-progress').querySelectorAll('span').forEach((el, index) => el.classList.toggle('filled', index < photos.length));
  $('#clue-label').textContent = [
    'FOLLOW THE RUSTLING NOTE',
    'WATCH THE CHAIRS',
    'SOMETHING IS GETTING CLOSER'
  ][act];
  $('#exposure-value').innerHTML = `${exposureSeconds.toFixed(2)}<span>s</span>`;
  $('#sound').textContent = sound.isEnabled ? '♫' : '♪̸';
}

function startGame() {
  sound.start();
  deathScreen.reset();
  world.resetFatal();
  delete game.dataset.deathCause;
  capture.reset();
  game.classList.remove('fatal-warning');
  world.clearExposure();
  iris.draw(1); irisOpen = 1; irisDirection = null;
  worldTime = 0; lastDisturbance = -5; lastFastCue = -1; lastPaperCycle = -1; lastChairCycle = -1; deathCause = null;
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
    setPhase('end'); endingClick = false;
    endPanel.classList.remove('last-click');
    $('#end-record').classList.add('hidden');
    resultPanel.classList.add('hidden');
    $('#hud').classList.remove('ready');
    const endPhotos = $('#end-photos');
    endPhotos.innerHTML = photos.map((url, index) => `<img src="${url}" alt="Ghost photograph ${index+1}">`).join('');
    endPanel.classList.remove('hidden');
    sound.tone(86, .55, .08, 'sine', 36);
    return;
  }
  act++;
  if (act === 1) lastFastCue = Math.floor((worldTime + .15) / 2.6);
  world.setAct(act);
  resultPanel.classList.add('hidden');
  prepareLook();
  syncHUD();
  sound.cue();
}
function prepareLook() {
  setPhase('look');
  exposureSeconds = 0;
  capture.reset();
  world.clearExposure();
  game.classList.remove('fatal-warning');
  resultPanel.classList.add('hidden');
  $('#hud').classList.add('ready');
  shutter.classList.remove('pressed');
  iris.draw(1); irisOpen = 1;
  irisDirection = null;
  hint.textContent = 'HOLD TO EXPOSE';
  hint.classList.toggle('gone', act !== 0);
  $('#signal-label').textContent = 'SPECTRAL SIGNAL';
  syncHUD();
}

const shotState = () => evaluateShot(capture.samples, act, exposureSeconds, sample => world.project(sample));
const fatalState = () => assessFatalExposure(capture.samples, act, exposureSeconds, sample => world.project(sample));

function die(cause: DeathCause) {
  if (phase === 'dead' || phase === 'dying') return;
  deathCause = cause;
  currentResult = null;
  irisDirection = null;
  iris.draw(0);
  irisOpen = 0;
  shutter.classList.remove('pressed');
  game.classList.remove('fatal-warning');
  world.showExposure(capture.samples, exposureSeconds);
  world.beginFatal(cause);
  sound.death();
  $('#hud').classList.remove('ready');
  resultPanel.classList.add('hidden');
  albumPanel.classList.add('hidden');
  endPanel.classList.add('hidden');
  game.dataset.deathCause = cause;
  setPhase('dying');
}


function endExposure(forced = false) {
  if (phase !== 'opening' && phase !== 'exposing') return;
  const t = performance.now() / 1000;
  capture.collect(t, exposureLimit(act), (time, age) => world.positionAt(time, age), true);
  exposureSeconds = capture.elapsed(t, exposureLimit(act));
  const danger = fatalState();
  if (danger.cause || forced) {
    die(danger.cause ?? (act === 2 ? 'TOO CLOSE' : 'OVEREXPOSED'));
    return;
  }
  currentResult = shotState();
  world.showExposure(capture.samples, exposureSeconds);
  sound.close();
  irisCloseFrom = irisOpen;
  iris.draw(Math.max(0, irisOpen - .06));
  currentPhoto = world.capture(); // Scene only: the DOM blades never enter the photograph.
  shots++;
  if (!currentResult.success) {
    const thumb = document.createElement('canvas'); thumb.width = 90; thumb.height = 120;
    thumb.getContext('2d')!.drawImage(canvas, 0, 0, 90, 120);
    history.unshift(thumb.toDataURL('image/jpeg', .65));
    if (history.length > 5) history.pop();
  }
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

function beginExposure() {
  if (phase !== 'look') return;
  sound.start(); sound.open();
  shutter.classList.add('pressed');
  $('#signal-label').textContent = 'SCANNING...';
  const now = performance.now() / 1000;
  capture.begin(now, worldTime);
  exposureSeconds = 0;
  irisDirection = 'open'; irisStart = now;
  iris.draw(0); irisOpen = 0;
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
      prepareLook();
    }
  }
});
$('#start-button').addEventListener('click', startGame);
$('#result-action').addEventListener('click', () => { if (phase === 'result') advance(); });
// A developing tap only reveals this print, never also advances or starts a shot.
resultPanel.addEventListener('click', event => {
  if (phase !== 'develop') return;
  event.preventDefault(); event.stopImmediatePropagation();
  finishDevelop();
}, true);
$('#death-restart').addEventListener('click', () => { if (phase === 'dead') startGame(); });
$('#replay').addEventListener('click', () => {
  endPanel.classList.add('hidden'); endPanel.classList.remove('last-click'); $('#end-record').classList.add('hidden'); startGame();
});
$('#sound').addEventListener('click', () => { sound.toggle(); syncHUD(); });
$('#album-button').addEventListener('click', () => {
  if (phase !== 'look' || photos.length === 0) return;
  albumFrom = phase; setPhase('album'); $('#hud').classList.remove('ready');
  $('#album-grid').innerHTML = photos.map((src, i) => `<div class="archive-entry"><img src="${src}" alt="Captured ghost ${i+1}"><span>0${i+1} · ${RECORDS[i].name} · ${photoTimes[i].toFixed(2)}s</span></div>`).join('');
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
  $('#print-subject').textContent = currentResult?.success ? RECORDS[act].name : 'LONG EXPOSURE';
  $('#result-label').textContent = currentResult?.label ?? 'UNKNOWN';
  $('#result-label').classList.toggle('success', !!currentResult?.success);
  $('#result-description').textContent = currentResult?.success ? RECORDS[act].note : (currentResult?.description ?? '');
  let strip = resultPanel.querySelector<HTMLElement>('.failed-prints');
  if (!strip) { strip = document.createElement('div'); strip.className = 'failed-prints'; $('#result-description').after(strip); }
  strip.innerHTML = history.map((src, i) => `<img src="${src}" alt="Recent attempt ${i + 1}">`).join('');
  $('#result-action').innerHTML = currentResult?.success ? 'CONTINUE <span>↗</span>' : 'TRY AGAIN <span>↗</span>';
  if (currentResult?.success) sound.detected(); else sound.miss();
  $<HTMLButtonElement>('#result-action').disabled = false;
  setPhase('develop');
}
function finishDevelop() {
  setPhase('result');
}

function frame(tMs: number) {
  requestAnimationFrame(frame);
  const t = tMs / 1000;
  const dt = lastTime ? clamp(t - lastTime, 0, .06) : 0;
  lastTime = t;
  if (document.hidden || matchMedia('(orientation:landscape) and (max-height:540px)').matches) return;
  if (phase === 'dying') {
    const age = t - phaseStarted;
    world.renderFatal(age, matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (age >= .82) {
      setPhase('dead');
      deathScreen.show(deathCause ?? 'OVEREXPOSED', act, world.capture());
    }
    return;
  }
  const exposing = phase === 'opening' || phase === 'exposing';
  if (phase === 'look' || exposing) {
    worldTime += dt;
  }
  if (phase === 'look' || exposing) world.tick(dt, worldTime, exposing, exposureSeconds);
  const fastCue = Math.floor((worldTime + .15) / 2.6);
  if (phase === 'look' && act === 1 && fastCue !== lastFastCue) {
    lastFastCue = fastCue;
    sound.disturbance(act);
  }
  if (act === 0 && (phase === 'look' || exposing)) {
    // Sound follows the actual Blender leaf and chair clip times, not a
    // separate arbitrary alarm clock.
    const cycle = Math.floor((worldTime - .55) / 4.1);
    const age = ((worldTime - .55) % 4.1 + 4.1) % 4.1;
    if (worldTime >= .55 && age >= .33 && cycle !== lastPaperCycle) {
      lastPaperCycle = cycle;
      sound.paperFlip();
    }
    if (worldTime >= .55 && age >= 1.14 && cycle !== lastChairCycle) {
      lastChairCycle = cycle;
      sound.chairScrape();
    }
  }
  if (phase === 'look' && act === 2 && worldTime - lastDisturbance >= 4.6) {
    lastDisturbance = worldTime;
    sound.disturbance(act);
  }

  if (exposing) {
    exposureSeconds = capture.elapsed(t, 2.4);
    capture.collect(t, exposureLimit(act), (time, age) => world.positionAt(time, age));
    world.showExposure(capture.samples, capture.recordedAge);
    const danger = fatalState();
    game.classList.toggle('fatal-warning', danger.warning);
    if (danger.cause) {
      die(danger.cause);
      return;
    }
    $('#exposure-value').innerHTML = `${exposureSeconds.toFixed(2)}<span>s</span>`;
    // The image is the exposure meter. No score or release instruction during a shot.
    $('#signal-label').textContent = danger.warning ? (act === 2 ? 'IT IS CLOSE' : 'THE FILM IS BURNING') : 'EXPOSING';
    sound.expose(exposureSeconds, act);
    if (phase === 'opening' && t - irisStart > .12) setPhase('exposing');
    if (phase !== 'dead' && exposureSeconds >= exposureLimit(act)) endExposure(true);
  }
  if (irisDirection === 'open') {
    const v = clamp((t - irisStart) / .12, 0, 1);
    irisOpen = 1 - Math.pow(1 - v, 2.3);
    iris.draw(irisOpen);
    if (v === 1) irisDirection = null;
  }
  if (irisDirection === 'close') {
    const v = clamp((t - irisStart) / .12, 0, 1);
    irisOpen = irisCloseFrom * Math.pow(1 - v, 2);
    iris.draw(irisOpen);
    if (v === 1) {
      irisDirection = null;
      if (phase === 'closing') { showResult(); iris.draw(1); irisOpen = 1; }
    }
  }
  if (phase === 'develop' && t - phaseStarted > .62) finishDevelop();
  if (phase === 'end' && !endingClick && t - phaseStarted > 1.5) {
    endingClick = true; sound.close();
    endPanel.classList.add('last-click');
    $('#end-record').classList.remove('hidden');
  }
  if (phase === 'look' || exposing || phase === 'closing') world.render();
}
window.addEventListener('resize', () => world.updateViewport());
async function boot() {
  try {
    await world.load();
    $('#loading').classList.add('hidden');
    world.setAct(0);
    syncHUD(); iris.draw(1);
    world.render();
    requestAnimationFrame(frame);
  } catch (error) {
    $('#loading').innerHTML = `CAMERA ERROR<br/><small>${String(error)}</small>`;
    console.error(error);
  }
}
void boot();

// Test-only read access to player state (no cheats or public API).
Object.defineProperty(window, '__longExposureState', {
  get: () => ({ phase, act, photos: photos.length, shots, exposureSeconds, quality: currentResult?.quality, label: currentResult?.label, deathCause })
});