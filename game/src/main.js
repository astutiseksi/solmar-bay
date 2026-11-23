// Solmar Bay — boot, the one loop, game state, saving, and the screens
// (title, play, paused, busted, wasted, won). The world advances in fixed
// 1/60 s steps; the renderer paints what is there.
// ?seed=N fixes the city. ?shot=start|play|chase|heist (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, START_HOUR, DAY_LENGTH_SECONDS, PLAYER, PISTOL, SAVE_KEY, BEST_KEY } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings, clampToWorld } from './world.js';
import { createInput, ACTION_ENTER, ACTION_PUNCH, ACTION_PAUSE, ACTION_CONFIRM, ACTION_RELOAD, ACTION_WEAPON, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { createTraffic, updateTrafficCar } from './vehicles.js';
import { createPeds, updatePeds, scarePeds } from './pedestrians.js';
import { explodeAt } from './combat.js';
import { MISSIONS, startMission } from './missions.js';
import { stepGame } from './engine.js';
import { createRenderer } from './render.js';
import { drawHUD, drawTitle, drawPaused, drawOver } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

export function createGame(seedValue) {
  const rng = createRandom(seedValue);
  const city = buildCity(rng);
  const G = {
    rng, city,
    audio: createAudio(),
    time: 0, hour: START_HOUR,
    money: 250, wanted: 0, heatTimer: 0,
    screen: 'title',
    camera: { x: 2220, y: 920 },
    shake: 0, muzzle: 0, copShootTimer: 0,
    bannerText: '', bannerTimer: 0, bannerColor: '#f5f1e8',
    hasSave: false,
    stats: { missions: 0, earned: 0, kills: 0, carsStolen: 0, packages: 0, distance: 0 },
    player: {
      x: 2220, y: 980, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, weapon: 'fists', ammo: PISTOL.magSize,
      shootCooldown: 0, punchCooldown: 0, punchAnim: 0, reloadTimer: 0,
    },
    cars: [], peds: [], cops: [], bullets: [], particles: [], pickups: [],
    mission: null,
    aimWorld: { x: 2220, y: 900 },
  };
  G.cars = createTraffic(rng, city);
  G.peds = createPeds(rng);
  G.playerSpawn = { x: 2220, y: 980 };

  G.addParticles = (x, y, n, color) => {
    for (let i = 0; i < n; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(40, 220);
      G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rng.range(0.3, 0.8), max: 0.8, size: rng.range(2, 5), color });
    }
    if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
  };
  G.explode = (x, y) => explodeAt(G, x, y);
  G.banner = (text, color) => { G.bannerText = text; G.bannerColor = color || '#f5f1e8'; G.bannerTimer = 3.2; };
  G.commitCrime = (stars, _reason) => {
    if (G.wanted < 5) G.wanted = Math.min(5, G.wanted + stars);
    G.heatTimer = 0;
  };
  G.damagePlayer = (amount, _cause) => {
    if (G.screen !== 'play') return;
    G.player.health -= amount;
    G.shake = Math.max(G.shake, 5);
    if (G.player.health <= 0) G.wasted();
  };
  G.busted = () => {
    if (G.screen !== 'play') return;
    G.money = Math.floor(G.money * 0.5);
    G.wanted = 0;
    G.cops = [];
    G.audio.busted();
    G.screen = 'busted';
    G.saveGame();
  };
  G.wasted = () => {
    if (G.screen !== 'play') return;
    G.money = Math.max(0, G.money - 200);
    G.wanted = 0;
    G.cops = [];
    G.audio.fail();
    G.screen = 'wasted';
    G.saveGame();
  };
  G.exitCar = (wrecked) => {
    const car = G.player.car;
    if (!car) return;
    G.player.car = null;
    G.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    G.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    G.player.angle = car.angle;
    if (wrecked) G.player.health = Math.max(20, G.player.health - 15);
    collideBuildings(G.city.buildings, G.player, PLAYER.radius);
  };
  G.enterCar = (car) => {
    if (car.traffic || car.parked) {
      car.traffic = false; car.parked = false; car.speed = 0;
      G.stats.carsStolen += 1;
      if (G.rng.chance(0.6)) G.commitCrime(1, 'car theft');
      G.audio.horn();
      scarePeds(G, car.x, car.y, 200);
    }
    G.player.car = car;
    // The player's ride is sturdier than a random traffic car.
    car.health = Math.max(car.health, 200);
  };
  G.saveGame = () => {
    try {
      const data = {
        money: G.money, hour: G.hour,
        stats: G.stats,
        player: { x: G.player.x, y: G.player.y, health: G.player.health, weapon: G.player.weapon, ammo: G.player.ammo },
        missionIndex: G.mission ? G.mission.index : G.stats.missions,
        collectibles: G.city.collectibles.map((c) => c.taken),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      const best = Math.max(G.money, readBest());
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch { /* storage off: progress lasts this visit only */ }
  };
  G.loadGame = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      G.money = d.money ?? 250;
      G.hour = d.hour ?? START_HOUR;
      Object.assign(G.stats, d.stats || {});
      Object.assign(G.player, d.player || {});
      G.player.car = null;
      if (Array.isArray(d.collectibles)) d.collectibles.forEach((t, i) => { if (G.city.collectibles[i]) G.city.collectibles[i].taken = !!t; });
      return true;
    } catch { return false; }
  };
  G.reset = () => {
    const fresh = createGame(seedValue);
    for (const key of Object.keys(fresh)) {
      if (key === 'audio') continue;
      G[key] = fresh[key];
    }
    G.screen = 'play';
    G.time = 0;
    G.hour = START_HOUR;
  };
  return G;
}

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}


// --- Boot ---
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const G = createGame(seed);
const renderer = createRenderer(canvas);
G.hasSave = !!window.localStorage.getItem(SAVE_KEY);

function announce(message) { status.textContent = message; }

function startGame(continueSave) {
  if (continueSave && G.loadGame()) {
    G.screen = 'play';
    const next = Math.min(G.stats.missions, MISSIONS.length - 1);
    startMission(G, next);
    announce('Continuing your story in Solmar Bay.');
  } else {
    G.reset();
    G.screen = 'play';
    startMission(G, 0);
    announce('Playing Solmar Bay. Steal a car and reach Lena\'s Garage.');
  }
  G.audio.unlock();
  G.audio.startMusic();
}

function runShot(name) {
  const scene = stageShot(name, G);
  G.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.drawWorld(G);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / 1280, 0, 0, canvas.width / 1280, 0, 0);
    if (G.screen === 'title') drawTitle(ctx, G, readBest());
    else drawHUD(ctx, G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (G.screen === 'title') startGame(G.hasSave);
      else if (G.screen === 'busted' || G.screen === 'wasted' || G.screen === 'won') {
        G.reset();
        G.screen = 'play';
        startMission(G, 0);
      }
    } else if (actions & ACTION_PAUSE) {
      if (G.screen === 'play') { G.screen = 'paused'; announce('Paused.'); }
      else if (G.screen === 'paused') { G.screen = 'play'; announce('Playing.'); }
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (G.screen === 'title') {
      // Attract mode: the city lives behind the title.
      while (accumulator >= STEP) {
        for (const car of G.cars) if (car.traffic) updateTrafficCar(G, car, STEP);
        updatePeds(G, STEP);
        G.time += STEP;
        G.hour = (START_HOUR + (G.time / DAY_LENGTH_SECONDS) * 24) % 24;
        G.camera.x = 2220 + Math.sin(G.time / 24) * 500;
        G.camera.y = 1500 + Math.cos(G.time / 31) * 400;
        accumulator -= STEP;
      }
    } else if (G.screen === 'play') {
      while (accumulator >= STEP && G.screen === 'play') {
        const axis = input.axis();
        const aimWorld = renderer.screenToWorld(G, input.mouse.x, input.mouse.y);
        stepGame(G, STEP, {
          axis, actions, run: input.running(),
          mouseDown: input.mouse.down,
          aimWorld,
          isDown: (c) => input.isDown(c),
        });
        accumulator -= STEP;
      }
      saveTimer += 1 / 60;
      if (saveTimer > 30) { saveTimer = 0; G.saveGame(); }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(G);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / 1280, 0, 0, canvas.width / 1280, 0, 0);
    if (G.screen === 'title') drawTitle(ctx, G, best);
    else if (G.screen === 'paused') drawPaused(ctx, G);
    else if (G.screen === 'busted') drawOver(ctx, G, 'busted');
    else if (G.screen === 'wasted') drawOver(ctx, G, 'wasted');
    else if (G.screen === 'won') drawOver(ctx, G, 'won');
    else drawHUD(ctx, G);
    if (G.money > best) { best = G.money; try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ } }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') { G.screen = 'paused'; announce('Paused.'); }
  });
  canvas.addEventListener('mousedown', () => { G.audio.unlock(); G.audio.startMusic(); });
  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
