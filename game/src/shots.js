// shots.js — staged screenshot scenes for ?shot=start|play|chase|heist.
// Each scene sets the game up (player position, car, wanted level, mission)
// and drives an autopilot along the road grid so the render is a real frame
// of the game playing by its own rules. Sets window.__shotReady when done.

import { TUNE } from './config.js';
import { shopByKind, nearestRoad } from './world.js';
import { makeCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';

export function setupShot(S, name) {
  S.shotMode = true;
  const W = S.world;
  const p = S.player;
  if (name === 'start') {
    // Title screen over the beach at golden hour.
    p.x = 600; p.y = 1900;
    S.screen = 'title';
    S.clock = 17 * 60 + 12;
    S.view.cam.x = p.x; S.view.cam.y = p.y;
    S.shotDone = true;
    window.__shotReady = true;
    return;
  }
  S.screen = 'play';
  S.clock = name === 'heist' ? 20 * 60 + 30 : 17 * 60 + 12;
  if (name === 'play') {
    // Milo on foot in Downtown, traffic passing, mission 1 briefing up.
    p.x = 2400; p.y = 1000; p.aim = 0.3;
    S.missions.index = 0; S.missions.active = true;
    S.missions.dialog = { who: 'Lena Cruz', text: 'Milo, you need wheels. Steal any car on the street and bring it to the Garage. Keep it clean.', title: '1 — Fresh Wheels' };
    S.missions.marker = { x: 2600, y: 1000, label: 'Garage' };
    S.auto = { route: gridRoute(S, 2400, 1000, 3400, 1000), i: 0 };
  } else if (name === 'chase') {
    // Milo driving a Sunrunner with 3 stars and two cop cars behind him.
    const model = CAR_MODELS.find((m) => m.name === 'Sunrunner');
    const car = makeCar(model, 2400, 2200, 0, { id: 777 });
    S.cars.push(car);
    p.car = car; p.inCar = true; p.x = car.x; p.y = car.y;
    p.wanted = 3; p.lastSeen = S.time;
    S.missions.index = 3; S.missions.active = true;
    S.missions.banner = 'Hot Pursuit — lose 3 stars!';
    S.bannerT = 999;
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(CAR_MODELS.find((m) => m.police), 2400 - 160 - i * 90, 2200 + (i ? 24 : -24), 0, { police: true, id: 900 + i });
      cop.speed = 300;
      S.cars.push(cop);
    }
    S.auto = { route: gridRoute(S, 2400, 2200, 4600, 2200), i: 0 };
  } else if (name === 'heist') {
    // The Big Score: Milo on foot outside the Bank at night, vault marker up.
    const bank = shopByKind(W, 'bank');
    p.x = bank.x + 120; p.y = bank.y + 160; p.aim = -Math.PI / 2;
    p.weapon = 'pistol';
    S.missions.index = 5; S.missions.active = true;
    S.missions.marker = { x: bank.x, y: bank.y, label: 'Bank vault' };
    S.missions.banner = 'The Big Score — crack the vault';
    S.bannerT = 999;
    p.money = 1250;
  }
  S.auto = S.auto || null;
  S.shotFrames = 0;
  S.shotTarget = name === 'start' ? 5 : 150;
}

// Drive the player's car along road grid waypoints toward a destination.
function gridRoute(S, x0, y0, x1, y1) {
  const pts = [];
  const roadY = nearestRoad(S.world, x0, y0).axis === 'h' ? nearestRoad(S.world, x0, y0).at : S.world.roadsH[1];
  pts.push({ x: x0, y: roadY });
  pts.push({ x: x1, y: roadY });
  pts.push({ x: x1, y: y1 });
  return pts;
}

// Called each frame in shot mode: steer the car (or walk) toward the route.
export function autopilot(S, dt, input) {
  if (!S.auto) return;
  const p = S.player;
  const target = S.auto.route[S.auto.i];
  if (!target) { S.auto = null; return; }
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
  if (d < 50) { S.auto.i++; return; }
  const want = Math.atan2(dy, dx);
  const heading = p.inCar && p.car ? p.car.angle : p.aim;
  let diff = want - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Feed synthetic keys into the input set.
  input.keys.add('KeyW');
  if (diff > 0.12) input.keys.add('KeyA'); else if (diff < -0.12) input.keys.add('KeyD');
  if (Math.abs(diff) > 1.2) input.keys.delete('KeyW');
}

// Marks the scene ready once enough frames have simulated.
export function shotTick(S) {
  S.shotFrames = (S.shotFrames || 0) + 1;
  if (S.shotFrames >= (S.shotTarget || 150)) {
    if (!S.shotDone) { S.shotDone = true; window.__shotReady = true; }
  }
}
