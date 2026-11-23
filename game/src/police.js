// police.js — wanted stars, cop cars that chase and ram, foot cops that chase
// and bust, return fire at 2+ stars, and heat that cools when unseen.

import { WORLD, CAR_MODELS, TUNE } from './config.js';
import { range, chance } from './random.js';
import { hitsBuilding } from './world.js';
import { makeCar, damageCar } from './vehicles.js';

export function addWanted(S, stars) {
  S.player.wanted = Math.max(0, Math.min(5, S.player.wanted + stars));
  if (S.player.wanted > 0) S.player.lastSeen = S.time;
}

export function updatePolice(S, dt) {
  const p = S.player;
  const wanted = p.wanted;
  // Spawn cop cars / foot cops up to the wanted level's cap.
  const wantCars = wanted === 0 ? 0 : Math.min(TUNE.copCarsMax, 1 + Math.floor(wanted / 2));
  const wantFoot = wanted === 0 ? 0 : Math.min(TUNE.footCopsMax, wanted + 1);
  const copCars = S.cars.filter((c) => c.police && !c.dead);
  const foot = S.cops.filter((c) => !c.dead);
  if (copCars.length < wantCars && S.spawnTimer <= 0) {
    spawnCopCar(S);
    S.spawnTimer = 2.5;
  }
  if (foot.length < wantFoot && S.spawnTimer <= 0) {
    spawnFootCop(S);
    S.spawnTimer = 2.5;
  }
  S.spawnTimer -= dt;

  // Cop cars chase the player and ram.
  for (const car of copCars) {
    const dx = p.x - car.x, dy = p.y - car.y, d = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 4 * dt));
    const target = d > 60 ? 380 : 160;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 420 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(S.world, nx, ny, car.model.len / 2 - 4)) { car.x = nx; car.y = ny; }
    else { car.speed *= 0.4; car.angle += 0.9 * dt * 4; }
    // Ram the player's car or the player.
    if (p.car && Math.hypot(p.car.x - car.x, p.car.y - car.y) < 62) {
      damageCar(S, p.car, 26 * dt);
      p.car.x += (p.car.x - car.x) * 0.02; p.car.y += (p.car.y - car.y) * 0.02;
      if (chance(S.rng, dt * 2)) S.audio.crash();
      S.shake = Math.max(S.shake, 5);
    }
    if (!p.inCar && d < 34) hurtPlayerFromCop(S, dt);
    // Cops shoot back at 2+ stars.
    if (wanted >= 2 && d < 420 && S.copShotTimer <= 0) {
      copShoot(S, car);
      S.copShotTimer = 1.1 + S.rng() * 0.8;
    }
  }
  S.copShotTimer -= dt;

  // Foot cops run at the player; standing close for bustTime busts them.
  for (const cop of foot) {
    const dx = p.x - cop.x, dy = p.y - cop.y, d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    const speed = 235;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    if (d < 46) {
      cop.bustT += dt;
      if (cop.bustT >= TUNE.bustTime) { bustPlayer(S); return; }
    } else cop.bustT = 0;
    if (!p.inCar && d < 40) hurtPlayerFromCop(S, dt);
    if (wanted >= 2 && d < 380 && S.copShotTimer <= 0) { copShoot(S, cop); S.copShotTimer = 1.4; }
  }

  // Heat cools after 26 s without being seen (no cop within 500 px).
  if (wanted > 0) {
    const seen = S.cars.some((c) => c.police && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 520) ||
      S.cops.some((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 420);
    if (seen) S.player.lastSeen = S.time;
    else if (S.time - S.player.lastSeen > TUNE.wantedDecayDelay) {
      S.player.wanted = Math.max(0, wanted - 1);
      S.player.lastSeen = S.time;
      if (S.player.wanted === 0) { S.cars = S.cars.filter((c) => !c.police); S.cops = []; }
    }
  }
}

function spawnCopCar(S) {
  const p = S.player;
  const a = S.rng() * Math.PI * 2;
  const x = p.x + Math.cos(a) * 700, y = p.y + Math.sin(a) * 700;
  const model = CAR_MODELS.find((m) => m.police);
  const car = makeCar(model, x, y, Math.atan2(p.y - y, p.x - x), { police: true, id: 9000 + S.cars.length });
  car.speed = 200;
  S.cars.push(car);
}

function spawnFootCop(S) {
  const p = S.player;
  const a = S.rng() * Math.PI * 2;
  S.cops.push({ x: p.x + Math.cos(a) * 420, y: p.y + Math.sin(a) * 420, angle: 0, bustT: 0, dead: false, hp: 60 });
}

function copShoot(S, from) {
  const p = S.player;
  const dx = p.x - from.x, dy = p.y - from.y, d = Math.hypot(dx, dy) || 1;
  const spread = (S.rng() - 0.5) * 0.35;
  const a = Math.atan2(dy, dx) + spread;
  S.bullets.push({ x: from.x + Math.cos(a) * 24, y: from.y + Math.sin(a) * 24, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, from: 'cop', life: 1.2, damage: 9 });
  S.particles.push({ kind: 'flash', x: from.x + Math.cos(a) * 26, y: from.y + Math.sin(a) * 26, t: 0, life: 0.07 });
  S.audio.shot();
}

function hurtPlayerFromCop(S, dt) {
  // Touch damage with a short cooldown handled by godTimer.
  if (S.player.godTimer <= 0) {
    S.player.hp -= 12;
    S.player.godTimer = 0.8;
    S.shake = Math.max(S.shake, 6);
    if (S.player.hp <= 0) { S.player.hp = 0; S.screen = 'wasted'; S.audio.fail(); }
  }
}

export function bustPlayer(S) {
  const fine = Math.min(S.player.money, TUNE.bustFine);
  S.player.money -= fine;
  S.player.wanted = 0;
  S.cars = S.cars.filter((c) => !c.police);
  S.cops = [];
  if (S.player.car) { S.player.car = null; S.player.inCar = false; }
  const hosp = S.world.shops.find((s) => s.kind === 'hospital');
  if (hosp) { S.player.x = hosp.x; S.player.y = hosp.y + 60; }
  S.player.hp = Math.max(S.player.hp, 50);
  S.screen = 'busted';
  S.bustedFine = fine;
  S.audio.busted();
}
