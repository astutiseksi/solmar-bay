// Solmar Bay itself: a seeded street grid, building blocks, the beach and
// sea on the east, the harbour south-west, a central park, shops, the
// safehouse, the hospital and the hidden packages. Also the geometry
// helpers every moving thing uses (road checks, building collisions).
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH, SEA, HARBOUR, PALETTE, DISTRICTS, COLLECTIBLE_COUNT } from './config.js';

const SHOPS = [
  { name: 'Lena\'s Garage', type: 'garage', x: 2220, y: 920, label: 'GARAGE' },
  { name: 'Solmar Bank', type: 'bank', x: 1020, y: 380, label: 'BANK' },
  { name: 'Harbor Docks', type: 'docks', x: 700, y: 3200, label: 'DOCKS' },
  { name: 'Palm Motel', type: 'motel', x: 4620, y: 1460, label: 'MOTEL' },
  { name: 'St. Mercy Hospital', type: 'hospital', x: 2820, y: 2540, label: 'HOSPITAL' },
  { name: 'Bayview Safehouse', type: 'safehouse', x: 3420, y: 3080, label: 'SAFEHOUSE' },
  { name: 'Neon Diner', type: 'diner', x: 1620, y: 2000, label: 'DINER' },
  { name: 'Ammu-Nation', type: 'ammo', x: 2220, y: 2540, label: 'AMMO' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solmar Bay';
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const palms = [];
  const lamps = [];
  // One building (or a small row) per city block, leaving the park block free.
  for (let xi = 0; xi < ROADS_X.length - 1; xi += 1) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi += 1) {
      const x0 = ROADS_X[xi] + ROAD_W / 2 + 26;
      const x1 = ROADS_X[xi + 1] - ROAD_W / 2 - 26;
      const y0 = ROADS_Y[yi] + ROAD_W / 2 + 26;
      const y1 = ROADS_Y[yi + 1] - ROAD_W / 2 - 26;
      const isPark = xi === 3 && yi === 2;
      if (isPark) {
        for (let t = 0; t < 14; t += 1) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(9, 15) });
        continue;
      }
      if (x0 > BEACH.x0) continue; // beach blocks stay open
      const bw = (x1 - x0) / 2 - 14;
      const bh = (y1 - y0) / 2 - 14;
      for (let b = 0; b < 4; b += 1) {
        const bx = x0 + (b % 2) * ((x1 - x0) / 2) + 7;
        const by = y0 + Math.floor(b / 2) * ((y1 - y0) / 2) + 7;
        if (rng.chance(0.12)) { // plaza / parking lot instead of a building
          for (let t = 0; t < 3; t += 1) trees.push({ x: rng.range(bx, bx + bw), y: rng.range(by, by + bh), r: rng.range(8, 12) });
          continue;
        }
        buildings.push({
          x: bx, y: by, w: bw * rng.range(0.75, 1), h: bh * rng.range(0.7, 1),
          color: rng.pick(PALETTE.building), roof: rng.pick(PALETTE.roof),
          floors: rng.int(1, 5), district: districtAt(bx + bw / 2, by + bh / 2),
        });
      }
    }
  }
  // Palms along the beach, trees on sidewalks, lamps at intersections.
  for (let y = 120; y < WORLD.height; y += 170) palms.push({ x: rng.range(BEACH.x0 + 14, BEACH.x1 - 10), y, r: 12 });
  for (let i = 0; i < 90; i += 1) {
    const rx = rng.pick(ROADS_X); const ry = rng.pick(ROADS_Y);
    trees.push({ x: rx + rng.range(-260, 260), y: ry + ROAD_W / 2 + 14, r: rng.range(8, 13) });
  }
  for (const rx of ROADS_X) for (const ry of ROADS_Y) lamps.push({ x: rx + ROAD_W / 2 - 8, y: ry - ROAD_W / 2 + 8 });

  const collectibles = [];
  for (let i = 0; i < COLLECTIBLE_COUNT; i += 1) {
    collectibles.push({
      x: rng.range(300, 4600), y: rng.range(300, 3300),
      taken: false, bob: rng.range(0, 6.28),
    });
  }
  // Keep collectibles out of buildings and water.
  for (const c of collectibles) {
    let guard = 0;
    while ((pointInBuilding(buildings, c.x, c.y) || c.x > BEACH.x0 || (c.x < HARBOUR.x1 && c.y > HARBOUR.y0)) && guard < 40) {
      c.x = rng.range(300, 4600); c.y = rng.range(300, 3300); guard += 1;
    }
  }
  const shops = SHOPS.map((s) => ({ ...s }));
  return { buildings, trees, palms, lamps, collectibles, shops, park: { x0: ROADS_X[3] + 60, y0: ROADS_Y[2] + 60, x1: ROADS_X[4] - 60, y1: ROADS_Y[3] - 60 } };
}

export function pointInBuilding(buildings, x, y) {
  for (const b of buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  return null;
}

/** Push a circle out of every building it overlaps; returns the building hit. */
export function collideBuildings(buildings, e, r) {
  let hit = null;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx; const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r; e.y = cy + (dy / d) * r;
      hit = b;
    } else if (d2 <= 0.01) {
      e.y = b.y - r; hit = b; // centre inside: push out the top
    }
  }
  return hit;
}

export function clampToWorld(e, margin) {
  e.x = Math.max(margin, Math.min(WORLD.width - margin, e.x));
  e.y = Math.max(margin, Math.min(WORLD.height - margin, e.y));
}

/** True when the point is on asphalt (a road), ignoring sidewalks. */
export function isOnRoad(x, y) {
  if (x > BEACH.x0) return false;
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null; let bd = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, axis: 'v', road: rx }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, axis: 'h', road: ry }; }
  }
  return best;
}

/** Daylight factor 0..1 from the in-game hour (5:30 sunrise, 19:30 sunset). */
export function daylight(hour) {
  if (hour < 5.5 || hour > 19.5) return 0.12;
  if (hour < 7) return 0.12 + ((hour - 5.5) / 1.5) * 0.88;
  if (hour > 18) return 1 - ((hour - 18) / 1.5) * 0.88;
  return 1;
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export { SEA, BEACH, HARBOUR };
