// world.js — generates the seeded city: road grid, building blocks, beach and
// sea, park, harbour, named shops, hidden packages, lamps and palms. Also the
// collision queries the rest of the game uses.

import { WORLD, DISTRICTS, PALETTE, TUNE } from './config.js';
import { range, intRange, pick, chance } from './random.js';

export function generateWorld(rng) {
  const world = {
    roadsV: [], roadsH: [], buildings: [], shops: [], packages: [],
    trees: [], lamps: [], park: null, sea: null, piers: [],
  };
  // Road centre lines: vertical every 400 px starting at 600, horizontal same.
  for (let x = 600; x < WORLD.w - 200; x += WORLD.roadGap) world.roadsV.push(x);
  for (let y = 600; y < WORLD.h - 200; y += WORLD.roadGap) world.roadsH.push(y);
  // Beach + sea on the west edge, harbour piers on the east edge.
  world.sea = { x: 0, y: 0, w: WORLD.beachX - 60, h: WORLD.h };
  world.beach = { x: WORLD.beachX - 60, y: 0, w: 60, h: WORLD.h };
  for (let i = 0; i < 3; i++) world.piers.push({ x: WORLD.w - 40, y: 1900 + i * 420, w: 40, h: 90 });
  // Central park between the middle roads.
  world.park = { x: 2200, y: 1500, w: 800, h: 600 };

  // Buildings fill every block between roads (skipping park, beach, harbour).
  const shopDefs = [
    { name: 'Garage', kind: 'garage' }, { name: 'Bank', kind: 'bank' },
    { name: 'Docks', kind: 'docks' }, { name: 'Motel', kind: 'motel' },
    { name: 'Hospital', kind: 'hospital' }, { name: 'Safehouse', kind: 'safehouse' },
    { name: 'Diner', kind: 'diner' }, { name: 'Ammo', kind: 'ammo' },
  ];
  let shopIdx = 0;
  const blockXs = [WORLD.beachX + 40, ...world.roadsV.map((x) => x + WORLD.roadHalf)];
  const blockYs = [40, ...world.roadsH.map((y) => y + WORLD.roadHalf)];
  const blockXe = [...world.roadsV.map((x) => x - WORLD.roadHalf), WORLD.w - 40];
  const blockYe = [...world.roadsH.map((y) => y - WORLD.roadHalf), WORLD.h - 40];
  for (let bi = 0; bi < blockXs.length; bi++) {
    for (let bj = 0; bj < blockYs.length; bj++) {
      const bx = blockXs[bi], by = blockYs[bj], bw = blockXe[bi] - bx, bh = blockYe[bj] - by;
      if (bw < 120 || bh < 120) continue;
      if (rectsOverlap({ x: bx, y: by, w: bw, h: bh }, world.park)) continue;
      if (bx + bw > 3750 && by > 1400) continue; // harbour yards stay open
      // 1-3 buildings per block, with a margin for the sidewalk.
      const n = intRange(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 90, Math.min(220, bw - 30));
        const h = range(rng, 80, Math.min(200, bh - 30));
        const x = bx + range(rng, 12, Math.max(13, bw - w - 12));
        const y = by + range(rng, 12, Math.max(13, bh - h - 12));
        const b = { x, y, w, h, hgt: intRange(rng, 1, 4), color: pick(rng, [PALETTE.building, PALETTE.building2, '#5d4a63', '#74604f']), lit: [] };
        for (let wi = 0; wi < Math.floor(w / 34); wi++)
          for (let wj = 0; wj < Math.floor(h / 34); wj++)
            if (chance(rng, 0.45)) b.lit.push({ dx: 8 + wi * 34, dy: 8 + wj * 34 });
        world.buildings.push(b);
        // First buildings in distinct districts become named shops.
        if (shopIdx < shopDefs.length && chance(rng, 0.5)) {
          const def = shopDefs[shopIdx++];
          const shop = { ...def, x: b.x + b.w / 2, y: b.y + b.h + 26, bx: b.x, by: b.y, bw: b.w, bh: b.h };
          world.shops.push(shop);
        }
      }
      // Trees / palms sprinkled on blocks and along the beach.
      if (chance(rng, 0.6)) world.trees.push({ x: bx + range(rng, 20, bw - 20), y: by + range(rng, 20, bh - 20), palm: chance(rng, 0.5) });
    }
  }
  // Any shop defs not placed get a spot on a downtown block edge.
  const fallbackSpots = [[1000, 1000], [2600, 600], [4600, 2600], [1000, 3000], [3000, 3200], [4200, 600], [1800, 2600], [3400, 1800]];
  while (shopIdx < shopDefs.length) {
    const def = shopDefs[shopIdx++];
    const s = fallbackSpots[shopIdx % fallbackSpots.length];
    world.shops.push({ ...def, x: s[0], y: s[1], bx: s[0] - 60, by: s[1] - 60, bw: 120, bh: 120 });
  }
  // Lamps at road intersections.
  for (const x of world.roadsV) for (const y of world.roadsH) world.lamps.push({ x: x + WORLD.roadHalf - 6, y: y - WORLD.roadHalf + 6 });
  // Hidden packages: tucked against buildings and along the beach.
  for (let i = 0; i < TUNE.hiddenPackages; i++) {
    const b = pick(rng, world.buildings);
    world.packages.push({ x: b.x + range(rng, -14, b.w + 14), y: b.y + b.h + range(rng, 4, 22), taken: false });
  }
  return world;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Is a circle (x, y, r) blocked by a building, or outside the playable area?
export function hitsBuilding(world, x, y, r) {
  if (x < WORLD.beachX - 50 || x > WORLD.w - 20 || y < 20 || y > WORLD.h - 20) return true;
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Push a circle out of buildings; returns true if a collision happened.
export function resolveCollision(world, e, r) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.01;
      e.x = cx + (dx / d) * r; e.y = cy + (dy / d) * r;
    }
  }
  return hit;
}

export function nearestRoad(world, x, y) {
  let best = null, bd = 1e9;
  for (const rx of world.roadsV) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { axis: 'v', at: rx, dist: d }; } }
  for (const ry of world.roadsH) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = { axis: 'h', at: ry, dist: d }; } }
  return best;
}

export function shopByKind(world, kind) { return world.shops.find((s) => s.kind === kind); }
export function onRoad(world, x, y) {
  return world.roadsV.some((rx) => Math.abs(x - rx) < WORLD.roadHalf) ||
    world.roadsH.some((ry) => Math.abs(y - ry) < WORLD.roadHalf);
}

// Night darkness factor 0 (day) .. 1 (deep night) from clock minutes.
export function darknessAt(clockMin) {
  const h = (clockMin / 60) % 24;
  if (h >= 7 && h < 17) return 0;
  if (h >= 17 && h < 19.5) return (h - 17) / 2.5 * 0.55;
  if (h >= 19.5 || h < 5) return 0.75;
  return (7 - h) / 2 * 0.75;
}
