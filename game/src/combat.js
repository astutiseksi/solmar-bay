// combat.js — fists, pistol, bullets, particles and explosions. Bullets hit
// peds, cops, cars and buildings; everything they touch feeds back into the
// wanted level, cash drops and screen shake.

import { TUNE } from './config.js';
import { range } from './random.js';
import { hitsBuilding } from './world.js';
import { damageCar, explodeCar, hurtPlayer } from './vehicles.js';
import { scarePeds, dropCash } from './pedestrians.js';
import { addWanted } from './police.js';

export function updateCombat(S, dt, input) {
  const p = S.player;
  p.godTimer = Math.max(0, p.godTimer - dt);
  p.punchT = Math.max(0, (p.punchT || 0) - dt);
  p.shootCd = Math.max(0, (p.shootCd || 0) - dt);
  p.reloadT = Math.max(0, (p.reloadT || 0) - dt);
  if (p.reloadT <= 0 && p.reloading) { p.reloading = false; const need = TUNE.pistolMag - p.mag; const take = Math.min(need, p.ammo); p.mag += take; p.ammo -= take; }

  if (S.screen !== 'play' || S.shotMode) return;

  // Punch: Space, short arc in front, knockback.
  if (input.hit('Space') && !p.inCar && p.punchT <= 0) {
    p.punchT = 0.35; p.punching = true;
    S.audio.punch();
    const ax = p.x + Math.cos(p.aim) * 30, ay = p.y + Math.sin(p.aim) * 30;
    for (const ped of S.peds) {
      if (!ped.dead && Math.hypot(ped.x - ax, ped.y - ay) < TUNE.punchRange) hitPed(S, ped, TUNE.punchDamage, p.aim);
    }
    for (const cop of S.cops) {
      if (!cop.dead && Math.hypot(cop.x - ax, cop.y - ay) < TUNE.punchRange) hitCop(S, cop, TUNE.punchDamage, p.aim);
    }
    S.shake = Math.max(S.shake, 3);
  } else if (p.punchT <= 0) p.punching = false;

  // Draw / holster pistol.
  if (input.hit('KeyQ') && !p.inCar) {
    p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';
    S.audio.reload();
  }
  // Reload.
  if (input.hit('KeyR') && p.weapon === 'pistol' && p.mag < TUNE.pistolMag && p.ammo > 0 && !p.reloading) {
    p.reloading = true; p.reloadT = 0.9; S.audio.reload();
  }
  // Fire: click, or Q already handled; mouse aim from camera.
  if ((input.mouseClicked || input.down('KeyF')) && p.weapon === 'pistol' && p.shootCd <= 0 && !p.reloading && !p.inCar) {
    firePistol(S);
  }

  updateBullets(S, dt);
  updateParticles(S, dt);
}

export function firePistol(S) {
  const p = S.player;
  if (p.mag <= 0) { S.audio.reload(); p.shootCd = 0.25; return; }
  p.mag--; p.shootCd = 0.16;
  const a = p.aim;
  S.bullets.push({
    x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26,
    vx: Math.cos(a) * TUNE.bulletSpeed, vy: Math.sin(a) * TUNE.bulletSpeed,
    from: 'player', life: 1.1, damage: TUNE.pistolDamage,
  });
  S.particles.push({ kind: 'flash', x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, t: 0, life: 0.06 });
  S.audio.shot();
  S.shake = Math.max(S.shake, 2.5);
  scarePeds(S, p.x, p.y, 420);
  if (p.wanted < 1) addWanted(S, 1);
}

function updateBullets(S, dt) {
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (hitsBuilding(S.world, b.x, b.y, 2)) {
      b.dead = true;
      S.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, t: 0, life: 0.25 });
      continue;
    }
    // Hit cars.
    for (const car of S.cars) {
      if (car.dead) continue;
      const dx = b.x - car.x, dy = b.y - car.y;
      const lx = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const ly = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
      if (Math.abs(lx) < car.model.len / 2 && Math.abs(ly) < car.model.wid / 2) {
        b.dead = true;
        damageCar(S, car, b.damage);
        if (b.from === 'player') { addWanted(S, 0); if (car.police) addWanted(S, 1); }
        break;
      }
    }
    if (b.dead) continue;
    // Hit the player (cop bullets).
    if (b.from === 'cop' && Math.hypot(b.x - S.player.x, b.y - S.player.y) < 14) {
      b.dead = true; hurtPlayer(S, b.damage); continue;
    }
    // Hit peds / foot cops (player bullets).
    if (b.from === 'player') {
      for (const ped of S.peds) {
        if (!ped.dead && Math.hypot(b.x - ped.x, b.y - ped.y) < 13) { b.dead = true; hitPed(S, ped, b.damage, Math.atan2(b.vy, b.vx)); break; }
      }
      if (b.dead) continue;
      for (const cop of S.cops) {
        if (!cop.dead && Math.hypot(b.x - cop.x, b.y - cop.y) < 13) { b.dead = true; hitCop(S, cop, b.damage, Math.atan2(b.vy, b.vx)); break; }
      }
    }
  }
  S.bullets = S.bullets.filter((b) => !b.dead);
}

export function hitPed(S, ped, dmg, angle) {
  ped.hp -= dmg;
  ped.x += Math.cos(angle) * 14; ped.y += Math.sin(angle) * 14;
  ped.panic = 3;
  if (ped.hp <= 0 && !ped.dead) {
    ped.dead = true;
    dropCash(S, ped.x, ped.y, 20 + Math.floor(S.rng() * 40));
    S.particles.push({ kind: 'poof', x: ped.x, y: ped.y, t: 0, life: 0.4 });
    addWanted(S, 1);
  }
}

export function hitCop(S, cop, dmg, angle) {
  cop.hp -= dmg;
  cop.x += Math.cos(angle) * 12; cop.y += Math.sin(angle) * 12;
  if (cop.hp <= 0 && !cop.dead) {
    cop.dead = true;
    dropCash(S, cop.x, cop.y, 40);
    addWanted(S, 1);
  }
}

export function updateParticles(S, dt) {
  for (const pt of S.particles) {
    pt.t += dt;
    if (pt.vx !== undefined) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; }
  }
  S.particles = S.particles.filter((pt) => pt.t < pt.life);
}

// Muzzle-flash + smoke helpers used by the renderer.
export function spawnSmoke(S, x, y) {
  S.particles.push({ kind: 'smoke', x, y, t: 0, life: 0.9, r: 10 + S.rng() * 8 });
}
