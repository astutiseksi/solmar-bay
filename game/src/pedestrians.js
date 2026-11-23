// pedestrians.js — people on the sidewalks: stroll between intersections,
// flee gunfire and speeding cars, and stand as taxi fares during Night Cab.

import { WORLD, TUNE } from './config.js';
import { range, intRange, pick, chance } from './random.js';
import { onRoad, nearestRoad } from './world.js';

const SHIRTS = ['#d85a5a', '#5a8fd8', '#5ad88a', '#d8c95a', '#b45ad8', '#e08a3c', '#7ad8d0', '#d8d8d8'];

export function spawnPeds(rng, world, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const axis = chance(rng, 0.5) ? 'v' : 'h';
    let x, y;
    if (axis === 'v') { x = pick(rng, world.roadsV) + (chance(rng, 0.5) ? -52 : 52); y = range(rng, 400, WORLD.h - 400); }
    else { y = pick(rng, world.roadsH) + (chance(rng, 0.5) ? -52 : 52); x = range(rng, 600, WORLD.w - 400); }
    peds.push({
      x, y, angle: range(rng, 0, Math.PI * 2), speed: range(rng, 40, 80),
      shirt: pick(rng, SHIRTS), state: 'walk', target: null, hp: 30, dead: false,
      panic: 0, fare: false, waitT: 0,
    });
  }
  return peds;
}

export function updatePeds(S, dt) {
  const px = S.player.x, py = S.player.y;
  for (const p of S.peds) {
    if (p.dead) continue;
    // Flee: gunfire nearby, or a fast car bearing down.
    if (p.panic > 0) {
      p.panic -= dt;
      p.state = 'flee';
      const dx = p.x - px, dy = p.y - py, d = Math.hypot(dx, dy) || 1;
      p.angle = Math.atan2(dy / d, dx / d);
      p.speed = 190;
    } else {
      p.state = p.fare ? 'wait' : 'walk';
      p.speed = p.fare ? 0 : range(S.rng, 50, 70);
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 24) {
        p.target = randomSidewalkTarget(S);
        p.angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      }
    }
    if (p.state !== 'wait') {
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      // Stay on sidewalks: refuse to walk deep into a block.
      if (!onRoad(S.world, nx, ny) && Math.hypot(nx - p.x, ny - p.y) > 0) {
        const near = nearestRoad(S.world, nx, ny);
        if (near && near.dist < 90) { p.x = nx; p.y = ny; }
        else { p.target = randomSidewalkTarget(S); }
      } else { p.x = nx; p.y = ny; }
    }
    p.x = Math.max(60, Math.min(WORLD.w - 60, p.x));
    p.y = Math.max(60, Math.min(WORLD.h - 60, p.y));
  }
}

function randomSidewalkTarget(S) {
  const w = S.world;
  const axis = chance(S.rng, 0.5) ? 'v' : 'h';
  if (axis === 'v') return { x: pick(S.rng, w.roadsV) + (chance(S.rng, 0.5) ? -52 : 52), y: range(S.rng, 400, WORLD.h - 400) };
  return { x: range(S.rng, 600, WORLD.w - 400), y: pick(S.rng, w.roadsH) + (chance(S.rng, 0.5) ? -52 : 52) };
}

// Everyone nearby panics when a shot is fired or a car screams past.
export function scarePeds(S, x, y, radius) {
  for (const p of S.peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) p.panic = 2.5 + S.rng() * 1.5;
  }
}

// Cash that pops out of a downed ped, picked up on foot.
export function dropCash(S, x, y, amount) {
  S.pickups.push({ kind: 'cash', x, y, amount, t: 0 });
}
