// vehicles.js — car entities: arcade physics for the player's car, grid
// traffic AI, parked cars, spawning, crashes and explosions.

import { WORLD, CAR_MODELS, TUNE } from './config.js';
import { range, intRange, pick, chance } from './random.js';
import { hitsBuilding, onRoad, nearestRoad } from './world.js';

export function makeCar(model, x, y, angle, opts = {}) {
  return {
    model, x, y, angle, speed: 0, hp: 100, color: opts.color || model.color,
    traffic: !!opts.traffic, parked: !!opts.parked, police: !!opts.police, taxi: !!opts.taxi,
    ai: opts.ai || null, dead: false, smoke: 0, brakeLight: false, id: opts.id || 0,
  };
}

export function spawnTraffic(rng, world, count, startId) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = pick(rng, CAR_MODELS.filter((m) => !m.police));
    const axis = chance(rng, 0.5) ? 'v' : 'h';
    let x, y, angle;
    if (axis === 'v') { x = pick(rng, world.roadsV) + (chance(rng, 0.5) ? -12 : 12); y = range(rng, 400, WORLD.h - 400); angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2; }
    else { y = pick(rng, world.roadsH) + (chance(rng, 0.5) ? -12 : 12); x = range(rng, 600, WORLD.w - 400); angle = chance(rng, 0.5) ? 0 : Math.PI; }
    cars.push(makeCar(model, x, y, angle, { traffic: true, taxi: model.taxi, id: startId + i, ai: { axis, dir: 1, targetSpeed: range(rng, 120, 190) } }));
  }
  return cars;
}

export function spawnParked(rng, world, count, startId) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 40) {
    tries++;
    const model = pick(rng, CAR_MODELS.filter((m) => !m.police && !m.taxi));
    const axis = chance(rng, 0.5) ? 'v' : 'h';
    let x, y, angle;
    if (axis === 'v') { x = pick(rng, world.roadsV) + (chance(rng, 0.5) ? -52 : 52); y = range(rng, 500, WORLD.h - 500); angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2; }
    else { y = pick(rng, world.roadsH) + (chance(rng, 0.5) ? -52 : 52); x = range(rng, 700, WORLD.w - 500); angle = chance(rng, 0.5) ? 0 : Math.PI; }
    // Parked cars sit on the sidewalk strip beside the road — never inside
    // a building, and never on top of another parked car.
    if (hitsBuilding(world, x, y, 30)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 80)) continue;
    cars.push(makeCar(model, x, y, angle, { parked: true, id: startId + cars.length }));
  }
  return cars;
}

// Arcade driving: throttle/brake/reverse, steering scaled by speed, handbrake
// drift, building + car collision with damage and smoke.
export function drivePlayerCar(S, car, input, dt) {
  const m = car.model;
  const forward = input.down('KeyW', 'ArrowUp');
  const back = input.down('KeyS', 'ArrowDown');
  const left = input.down('KeyA', 'ArrowLeft');
  const right = input.down('KeyD', 'ArrowRight');
  const handbrake = input.down('Space');
  if (forward) car.speed += m.accel * dt;
  if (back) car.speed -= (car.speed > 8 ? m.accel * 1.25 : m.accel * 0.55) * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
  car.speed = Math.max(-m.top * 0.45, Math.min(m.top, car.speed));
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const spd = Math.abs(car.speed);
  const grip = handbrake ? m.grip * 0.45 : m.grip;
  car.angle += steer * grip * (spd / m.top) * dt * Math.sign(car.speed || 1) * -1;
  car.brakeLight = back || handbrake;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = m.len / 2 - 4;
  if (!hitsBuilding(S.world, nx, ny, r)) { car.x = nx; car.y = ny; }
  else {
    if (spd > 130) { damageCar(S, car, spd * 0.09); S.audio.crash(); S.shake = Math.min(14, spd * 0.03); }
    car.speed *= -0.25;
  }
  car.x = Math.max(40, Math.min(WORLD.w - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.h - 40, car.y));
  if (car.hp < 45) car.smoke += dt;
  if (car.hp <= 0 && !car.dead) { car.dead = true; explodeCar(S, car); }
  return car.speed;
}

export function damageCar(S, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.dead) { car.dead = true; explodeCar(S, car); }
}

export function explodeCar(S, car) {
  S.particles.push({ kind: 'boom', x: car.x, y: car.y, t: 0, life: 0.8, r: 60 });
  for (let i = 0; i < 26; i++) S.particles.push({ kind: 'spark', x: car.x, y: car.y, vx: range(S.rng, -260, 260), vy: range(S.rng, -260, 260), t: 0, life: range(S.rng, 0.3, 0.8) });
  S.audio.explosion();
  S.shake = 18;
  if (S.player.car === car) { S.player.car = null; S.player.inCar = false; hurtPlayer(S, 30); }
}

// Traffic: cruise along the current road; at intersections sometimes turn.
// Slow down for the car ahead; nudge around the player's car.
export function updateTraffic(S, dt) {
  for (const car of S.cars) {
    if (!car.traffic || car.dead) continue;
    const ai = car.ai;
    // Car ahead on the same road? brake.
    let blocked = false;
    for (const other of S.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) { blocked = true; break; }
    }
    const target = blocked ? 0 : ai.targetSpeed;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 160 * dt);
    const near = nearestRoad(S.world, car.x, car.y);
    // Steer back toward the road centre line so traffic stays in its lane.
    if (near) {
      const desired = near.axis === 'v'
        ? (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2)
        : (Math.cos(car.angle) >= 0 ? 0 : Math.PI);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2 * dt));
      const laneOff = near.axis === 'v' ? car.x - near.at : car.y - near.at;
      car.angle += Math.max(-1.2 * dt, Math.min(1.2 * dt, -laneOff * 0.0009 * dt * 60));
    }
    // At an intersection, sometimes turn onto the cross road.
    if (near && near.dist < 12 && chance(S.rng, dt * 0.25)) {
      if (near.axis === 'v') { car.angle = chance(S.rng, 0.5) ? 0 : Math.PI; }
      else { car.angle = chance(S.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2; }
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(S.world, nx, ny, car.model.len / 2 - 4)) { car.x = nx; car.y = ny; }
    else { car.angle += Math.PI / 2; car.speed *= 0.5; }
    if (car.x < 300 || car.x > WORLD.w - 100 || car.y < 100 || car.y > WORLD.h - 100) {
      // Wrap around the far side so traffic never runs out.
      car.x = 700 + S.rng() * (WORLD.w - 1400); car.y = 700 + S.rng() * (WORLD.h - 1400);
    }
  }
}

// Nearest driveable car to a point (for E to enter / steal).
export function nearestCar(S, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function hurtPlayer(S, amount) {
  if (S.player.godTimer > 0) return;
  S.player.hp -= amount;
  S.player.godTimer = 0.4;
  if (S.player.hp <= 0) { S.player.hp = 0; S.screen = 'wasted'; S.audio.fail(); }
}
