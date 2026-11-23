// Pedestrians: office workers, beach-goers, dock hands and tourists who
// stroll the sidewalks, chat, and run screaming from gunfire and speeding
// cars. Some are mission fares; the rest just make the city feel alive.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W } from './config.js';
import { collideBuildings, clampToWorld } from './world.js';

const NAMES = ['Mara', 'Tomas', 'Iris', 'Kiko', 'Rosa', 'Felix', 'Nadia', 'Omar', 'Luz', 'Benny', 'Cora', 'Dante'];
const SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#8bc34a', '#ff8a65', '#ba68c8', '#fff176', '#4db6ac', '#f06292', '#90a4ae'];

export function makePed(rng, x, y) {
  const axis = rng.chance(0.5) ? 'h' : 'v';
  const road = axis === 'h' ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
  return {
    name: rng.pick(NAMES),
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(45, 75),
    state: 'walk', // walk | flee | fare | dead
    axis, road, dir: rng.chance(0.5) ? 1 : -1,
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(['#f2c9a0', '#d9a06b', '#a06b3f', '#8a5a2e']),
    panic: 0, wait: rng.range(0, 3),
    fare: null,
  };
}

export function createPeds(rng) {
  const peds = [];
  for (let i = 0; i < 46; i += 1) {
    const axis = rng.chance(0.5) ? 'h' : 'v';
    const road = axis === 'h' ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const s = rng.range(200, axis === 'h' ? 4600 : 3300);
    const off = ROAD_W / 2 + 12 + rng.range(0, 14);
    const x = axis === 'h' ? s : road + (rng.chance(0.5) ? off : -off);
    const y = axis === 'h' ? road + (rng.chance(0.5) ? off : -off) : s;
    peds.push(makePed(rng, x, y));
  }
  return peds;
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'dead' || p.fare) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) { p.state = 'flee'; p.panic = 2.5; p.fleeX = x; p.fleeY = y; }
  }
}

export function updatePed(G, p, dt) {
  if (p.state === 'dead') return;
  if (p.panic > 0) p.panic -= dt;
  if (p.state === 'flee') {
    const dx = p.x - (p.fleeX ?? G.player.x);
    const dy = p.y - (p.fleeY ?? G.player.y);
    const d = Math.hypot(dx, dy) || 1;
    p.angle = Math.atan2(dy, dx);
    p.x += (dx / d) * 190 * dt;
    p.y += (dy / d) * 190 * dt;
    if (p.panic <= 0) p.state = 'walk';
  } else if (p.state === 'fare') {
    // Waiting for the taxi: stand still, wave.
    p.wait += dt;
    return;
  } else {
    if (p.wait > 0) { p.wait -= dt; return; }
    const step = p.speed * p.dir * dt;
    if (p.axis === 'h') {
      p.x += step;
      p.angle = p.dir > 0 ? 0 : Math.PI;
      if (p.x < 180 || p.x > WORLD.width - 620) { p.dir *= -1; p.wait = 1; }
    } else {
      p.y += step;
      p.angle = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.y < 180 || p.y > WORLD.height - 220) { p.dir *= -1; p.wait = 1; }
    }
    // At an intersection, sometimes turn down the crossing street.
    const crossing = (p.axis === 'h' ? ROADS_X : ROADS_Y).find((r) => Math.abs((p.axis === 'h' ? p.x : p.y) - r) < 5);
    if (crossing !== undefined && G.rng.chance(0.01)) {
      p.axis = p.axis === 'h' ? 'v' : 'h';
      p.road = crossing;
      p.dir = G.rng.chance(0.5) ? 1 : -1;
      if (p.axis === 'h') p.y = p.road + (p.dir > 0 ? ROAD_W / 2 + 12 : -ROAD_W / 2 - 12);
      else p.x = p.road + (p.dir > 0 ? ROAD_W / 2 + 12 : -ROAD_W / 2 - 12);
    }
  }
  collideBuildings(G.city.buildings, p, 12);
  clampToWorld(p, 30);
}

export function updatePeds(G, dt) {
  for (const p of G.peds) updatePed(G, p, dt);
}
