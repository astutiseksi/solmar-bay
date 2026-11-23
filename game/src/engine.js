// engine.js — one fixed simulation tick, shared by the live loop and the
// screenshot stager. It moves the player, cars, peds and cops, runs combat,
// missions and the clock, and keeps the camera on the action.

import { WORLD, TUNE } from './config.js';
import { resolveCollision, hitsBuilding, shopByKind } from './world.js';
import { drivePlayerCar, updateTraffic, nearestCar, damageCar } from './vehicles.js';
import { updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateCombat, spawnSmoke } from './combat.js';
import { updateMissions, startMission } from './missions.js';

export function tick(S, dt, input) {
  S.time += dt;
  S.clock = (S.clock + dt * 0.5) % (24 * 60); // game clock runs ~30x real time
  const p = S.player;
  p.godTimer = Math.max(0, p.godTimer - dt);

  // Aim follows the mouse (screen -> world through the camera).
  if (S.view && !p.inCar) {
    const wx = S.view.cam.x + (input.mouseX - S.view.cw / 2) / S.view.cam.zoom;
    const wy = S.view.cam.y + (input.mouseY - S.view.ch / 2) / S.view.cam.zoom;
    p.aim = Math.atan2(wy - p.y, wx - p.x);
  } else if (p.inCar && p.car) p.aim = p.car.angle;

  // Enter / exit a car.
  if (input.hit('KeyE')) {
    if (p.inCar) exitCar(S);
    else enterCar(S);
  }

  if (p.inCar && p.car) {
    drivePlayerCar(S, p.car, input, dt);
    p.x = p.car.x; p.y = p.car.y;
    if (p.car.dead) { p.car = null; p.inCar = false; }
    // Smash through peds while driving fast? No — swerve them away instead.
    for (const ped of S.peds) {
      if (!ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 40 && Math.abs(p.car.speed) > 200) ped.panic = 3;
    }
  } else {
    // On foot: WASD / arrows, Shift to run.
    const run = input.down('ShiftLeft', 'ShiftRight');
    const speed = run ? TUNE.runSpeed : TUNE.walkSpeed;
    let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    let my = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      const nx = p.x + mx * speed * dt, ny = p.y + my * speed * dt;
      if (!hitsBuilding(S.world, nx, p.y, 12)) p.x = nx;
      if (!hitsBuilding(S.world, p.x, ny, 12)) p.y = ny;
      p.moving = true;
      p.walkPhase = (p.walkPhase || 0) + dt * 9;
    } else p.moving = false;
  }

  // Car-to-car bumps between the player's car and traffic.
  if (p.inCar && p.car) {
    for (const car of S.cars) {
      if (car === p.car || car.dead) continue;
      const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
      if (d < 52 && d > 0.01) {
        const push = (52 - d) / 2;
        const nx = (p.car.x - car.x) / d, ny = (p.car.y - car.y) / d;
        p.car.x += nx * push; p.car.y += ny * push;
        car.x -= nx * push; car.y -= ny * push;
        if (Math.abs(p.car.speed) > 120) { damageCar(S, p.car, 6); damageCar(S, car, 6); S.audio.crash(); S.shake = Math.max(S.shake, 4); }
      }
    }
  }

  updateTraffic(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateCombat(S, dt, input);
  updateMissions(S, dt);

  // Smoking cars puff.
  for (const car of S.cars) if (!car.dead && car.hp < 45 && Math.random() < dt * 6) spawnSmoke(S, car.x, car.y - 10);

  // Pickups: hidden packages (+$100) and cash drops.
  for (const pk of S.world.packages) {
    if (!pk.taken && !p.inCar && Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      pk.taken = true; p.money += TUNE.packageReward; S.audio.pickup();
      S.missions.banner = 'Hidden package! +$100'; S.bannerT = 2.5;
      S.packagesFound = (S.packagesFound || 0) + 1;
    }
  }
  for (const pk of S.pickups) {
    pk.t += dt;
    if (!p.inCar && Math.hypot(pk.x - p.x, pk.y - p.y) < 28) {
      pk.dead = true; p.money += pk.amount; S.audio.cash();
    }
  }
  S.pickups = S.pickups.filter((k) => !k.dead && k.t < 30);

  // Shop zones: hospital heals, garage refills ammo and repairs.
  const hosp = shopByKind(S.world, 'hospital');
  if (hosp && Math.hypot(p.x - hosp.x, p.y - hosp.y) < 90 && p.hp < TUNE.playerHp && p.money >= TUNE.hospitalCost) {
    p.money -= TUNE.hospitalCost; p.hp = TUNE.playerHp; S.audio.pickup();
    S.missions.banner = 'Hospital: healed — $80'; S.bannerT = 2;
  }
  const garage = shopByKind(S.world, 'garage');
  if (garage && p.inCar && p.car && Math.hypot(p.x - garage.x, p.y - garage.y) < 100 && (p.ammo < TUNE.pistolReserve || p.car.hp < 100) && p.money >= TUNE.ammoCost) {
    p.money -= TUNE.ammoCost; p.ammo = TUNE.pistolReserve; p.car.hp = 100; S.audio.pickup();
    S.missions.banner = 'Garage: ammo + repairs — $50'; S.bannerT = 2;
  }

  // Mission start / retry.
  if (input.hit('Enter') && S.screen === 'play' && !S.missions.active && !S.missions.won && !S.missions.dialog) {
    startMission(S);
  }
  if (S.missions.retry && input.hit('Enter')) {
    S.missions.retry = false;
    S.missions.index = Math.max(0, S.missions.index);
    startMission(S);
  }
  if (S.missions.dialog && input.hit('Enter')) S.missions.dialog = null;

  // Banner timer.
  S.bannerT = Math.max(0, (S.bannerT || 0) - dt);
  if (S.bannerT <= 0) S.missions.banner = null;

  // Camera: follow the player, zoom out while driving.
  const targetZoom = p.inCar ? 0.62 : 0.85;
  S.view.cam.zoom += (targetZoom - S.view.cam.zoom) * Math.min(1, dt * 3);
  S.view.cam.x += (p.x - S.view.cam.x) * Math.min(1, dt * 6);
  S.view.cam.y += (p.y - S.view.cam.y) * Math.min(1, dt * 6);
  S.shake = Math.max(0, S.shake - dt * 30);
  S.shakeX = (Math.random() - 0.5) * S.shake;
  S.shakeY = (Math.random() - 0.5) * S.shake;

  // Audio follows the action.
  S.audio.setEngine(p.inCar && p.car ? Math.abs(p.car.speed) / p.car.model.top : 0, !!p.inCar);
  S.audio.setSiren(p.wanted > 0, dt);
}

function enterCar(S) {
  const p = S.player;
  const car = nearestCar(S, p.x, p.y, 70);
  if (!car) return;
  if (car.parked || car.traffic) {
    // Stealing a car the law can see earns heat.
    if (Math.random() < 0.6 && p.wanted < 2) {
      p.wanted = Math.max(p.wanted, 1);
      p.lastSeen = S.time;
    }
  }
  car.parked = false; car.traffic = false; car.ai = null;
  p.car = car; p.inCar = true;
  p.x = car.x; p.y = car.y;
  S.audio.pickup();
}

function exitCar(S) {
  const p = S.player;
  const car = p.car;
  p.inCar = false; p.car = null;
  const a = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(a) * 34;
  p.y = car.y + Math.sin(a) * 34;
  if (hitsBuilding(S.world, p.x, p.y, 12)) { p.x = car.x - Math.cos(a) * 34; p.y = car.y - Math.sin(a) * 34; }
}
