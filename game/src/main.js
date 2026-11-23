// main.js — boot, game loop, screens, save/load and the shared game state.
// Everything the other modules need lives on S, built here once.

import { makeRng, hashSeed } from './random.js';
import { WORLD, TUNE, CAR_MODELS } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { generateWorld, shopByKind } from './world.js';
import { spawnTraffic, spawnParked } from './vehicles.js';
import { spawnPeds } from './pedestrians.js';
import { tick } from './engine.js';
import { createMissions, startMission } from './missions.js';
import { drawWorld } from './render.js';
import { drawHud, drawScreen } from './hud.js';
import { setupShot, autopilot, shotTick } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? (Number(seedParam) || hashSeed(seedParam)) : 20261123;
const shot = params.get('shot');

const rng = makeRng(seed);
const world = generateWorld(rng);

const S = {
  rng, world, seed,
  time: 0, clock: TUNE.startClockMin,
  screen: 'title',
  player: null, cars: [], peds: [], cops: [], bullets: [], particles: [], pickups: [],
  missions: null, audio: createAudio(), input: null,
  view: { cam: { x: 600, y: 1900, zoom: 0.85 }, cw: canvas.width, ch: canvas.height },
  shake: 0, shakeX: 0, shakeY: 0, bannerT: 0, spawnTimer: 0, copShotTimer: 0,
  bustedFine: 0, packagesFound: 0, hasSave: false, saveMoney: 0, saveMission: 0,
  shotMode: false, shotDone: false, auto: null,
};

S.input = createInput(canvas);
S.missions = createMissions(S);

function freshPlayer() {
  return {
    x: 600, y: 1900, aim: 0, hp: TUNE.playerHp, money: 250,
    ammo: TUNE.pistolReserve, mag: TUNE.pistolMag, weapon: 'fists',
    wanted: 0, lastSeen: 0, inCar: false, car: null,
    godTimer: 0, punchT: 0, punching: false, shootCd: 0, reloadT: 0, reloading: false,
    moving: false, walkPhase: 0,
  };
}
S.player = freshPlayer();

// Traffic, parked cars and peds fill the city.
S.cars = [
  ...spawnTraffic(rng, world, TUNE.trafficCars, 1),
  ...spawnParked(rng, world, TUNE.parkedCars, 100),
];
S.peds = spawnPeds(rng, world, TUNE.pedCount);

// Save / load (localStorage).
const SAVE_KEY = 'solmar-bay-save-v1';
S.saveGame = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.player.money, mission: S.missions.index, hp: S.player.hp,
      packages: S.world.packages.map((p) => p.taken),
    }));
  } catch { /* storage unavailable — play on without saving */ }
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
const saved = loadSave();
if (saved) {
  S.hasSave = true; S.saveMoney = saved.money || 0; S.saveMission = saved.mission || 0;
}
function applySave() {
  if (!saved) return;
  S.player.money = saved.money || 250;
  S.player.hp = saved.hp || TUNE.playerHp;
  S.missions.index = Math.min(saved.mission || 0, 5);
  if (Array.isArray(saved.packages)) saved.packages.forEach((t, i) => { if (S.world.packages[i]) S.world.packages[i].taken = t; });
}

// Screen transitions.
function startGame() {
  S.audio.unlock();
  S.audio.startMusic();
  if (S.hasSave) applySave();
  S.screen = 'play';
  S.missions.dialog = null;
}
function respawnAfterEnd(kind) {
  const hosp = shopByKind(world, 'hospital');
  S.player.x = hosp.x; S.player.y = hosp.y + 60;
  S.player.hp = TUNE.playerHp;
  S.player.wanted = 0;
  S.cars = S.cars.filter((c) => !c.police);
  S.cops = [];
  if (kind === 'wasted') S.player.money = Math.max(0, S.player.money - TUNE.deathFine);
  S.player.inCar = false; S.player.car = null;
  S.screen = 'play';
  S.saveGame();
}

// Screenshot scenes take over the boot.
if (shot) setupShot(S, shot);

// Main loop: fixed 1/60 s steps, render every frame.
let last = performance.now();
let acc = 0;
function frame(now) {
  const dtMs = Math.min(100, now - last);
  last = now;
  acc += dtMs;
  const input = S.input;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    step(1 / 60);
  }
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

function step(dt) {
  const input = S.input;
  // Global keys.
  if (input.hit('KeyM')) S.audio.toggleMute();
  if (input.hit('KeyP') && (S.screen === 'play' || S.screen === 'pause')) {
    S.screen = S.screen === 'play' ? 'pause' : 'play';
  }
  if (S.screen === 'title' && input.hit('Enter')) startGame();
  else if (S.screen === 'pause' && input.hit('Enter')) {
    // Restart the current mission from the pause screen.
    S.missions.active = false; S.missions.retry = false; S.missions.step = 0;
    S.screen = 'play';
    startMission(S);
  }
  else if ((S.screen === 'busted' || S.screen === 'wasted') && input.hit('Enter')) {
    respawnAfterEnd(S.screen);
  }
  else if (S.screen === 'won' && input.hit('Enter')) {
    S.screen = 'play'; S.missions.won = false; S.missions.active = false;
  }

  if (S.screen === 'play') {
    if (S.shotMode) autopilot(S, dt, input);
    tick(S, dt, input);
    if (S.shotMode) shotTick(S);
  }
  // Camera follows even on menus so the title shows the city.
  S.view.cw = canvas.width; S.view.ch = canvas.height;
  if (S.screen !== 'play') {
    S.view.cam.x += (S.player.x - S.view.cam.x) * 0.02;
    S.view.cam.y += (S.player.y - S.view.cam.y) * 0.02;
  }
}

function render() {
  const cw = canvas.width, ch = canvas.height;
  S.view.cw = cw; S.view.ch = ch;
  ctx.fillStyle = '#0c0e18';
  ctx.fillRect(0, 0, cw, ch);
  drawWorld(S, ctx, S.view);
  if (S.screen === 'play') drawHud(S, ctx, cw, ch);
  drawScreen(S, ctx, cw, ch);
  // Shot scenes hide the dialog after a beat so the frame reads clean.
  if (S.shotMode && S.shotFrames > 60 && S.missions.dialog && S.screen === 'play') {
    // keep the dialog: it shows the story in the screenshot
  }
}

window.__solmar = S;
requestAnimationFrame(frame);
