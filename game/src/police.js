// The Solmar Bay Police Department: wanted stars, cop cars that chase and
// ram, foot cops that chase and bust, and the heat that cools off when the
// player lays low out of sight.
import { WANTED, WANTED_DECAY_SECONDS, BUST_RADIUS, BUST_SECONDS } from './config.js';
import { collideBuildings, clampToWorld, nearestRoadPoint } from './world.js';
import { makeCar } from './vehicles.js';

export function wantedLevel(G) {
  return WANTED[Math.min(5, G.wanted)];
}

export function spawnCopCar(G) {
  const near = nearestRoadPoint(G.player.x, G.player.y);
  const angle = G.rng.range(0, Math.PI * 2);
  const dist = G.rng.range(500, 750);
  const x = G.player.x + Math.cos(angle) * dist;
  const y = G.player.y + Math.sin(angle) * dist;
  const car = makeCar(G.rng, x, y, 0, { color: '#1c2f5e', traffic: false });
  car.cop = true;
  car.model = { name: 'Interceptor', color: '#1c2f5e', speed: 1.14 };
  car.cruise = 320;
  G.cars.push(car);
  G.cops.push({ kind: 'car', car, bustTimer: 0 });
  return car;
}

export function spawnFootCop(G) {
  const angle = G.rng.range(0, Math.PI * 2);
  const dist = G.rng.range(320, 480);
  const cop = {
    kind: 'foot',
    x: G.player.x + Math.cos(angle) * dist,
    y: G.player.y + Math.sin(angle) * dist,
    speed: 235, bustTimer: 0, angle: 0, shirt: '#1c2f5e', skin: '#d9a06b',
    state: 'chase', name: 'Officer',
  };
  G.cops.push(cop);
  return cop;
}

function copSeesPlayer(G, cop) {
  const px = cop.kind === 'car' ? cop.car.x : cop.x;
  const py = cop.kind === 'car' ? cop.car.y : cop.y;
  return Math.hypot(px - G.player.x, py - G.player.y) < 620;
}

export function updatePolice(G, dt) {
  const want = wantedLevel(G);
  // Spawn up to the wanted level's quota.
  const carCops = G.cops.filter((c) => c.kind === 'car').length;
  const footCops = G.cops.filter((c) => c.kind === 'foot').length;
  if (G.wanted > 0) {
    if (carCops < want.cops && G.rng.chance(0.02)) spawnCopCar(G);
    if (footCops < want.footCops && !G.player.car && G.rng.chance(0.02)) spawnFootCop(G);
  }
  // Heat cools when no cop can see the player.
  if (G.wanted > 0) {
    const seen = G.cops.some((c) => copSeesPlayer(G, c));
    if (!seen) {
      G.heatTimer += dt;
      if (G.heatTimer > WANTED_DECAY_SECONDS) {
        G.wanted -= 1;
        G.heatTimer = 0;
        G.banner(`Heat down — ${G.wanted} star${G.wanted === 1 ? '' : 's'}`, '#7ee081');
      }
    } else G.heatTimer = 0;
  }

  for (const cop of [...G.cops]) {
    if (cop.kind === 'car') {
      const car = cop.car;
      if (car.dead) { removeCop(G, cop); continue; }
      const dx = G.player.x - car.x;
      const dy = G.player.y - car.y;
      const dist = Math.hypot(dx, dy);
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const targetSpeed = dist > 120 ? 520 : 300;
      car.speed += Math.max(-600 * dt, Math.min(500 * dt, targetSpeed - car.speed));
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2.2 * dt * 10)) * 0.35;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      collideBuildings(G.city.buildings, car, 22);
      clampToWorld(car, 40);
      // Ram the player's car.
      if (G.player.car) {
        const pc = G.player.car;
        const d = Math.hypot(pc.x - car.x, pc.y - car.y);
        if (d < 52 && Math.abs(car.speed) > 120) {
          pc.health -= 1;
          pc.x += ((pc.x - car.x) / (d || 1)) * 14;
          pc.y += ((pc.y - car.y) / (d || 1)) * 14;
          G.audio.crash();
          G.shake = Math.max(G.shake, 5);
          G.addParticles(pc.x, pc.y, 5, '#ffd94d');
        }
        if (pc.health <= 0 && !pc.dead) { pc.dead = true; G.explode(pc.x, pc.y); G.exitCar(true); }
      } else if (dist < 60 && Math.abs(car.speed) > 150) {
        // Run over on foot: heavy damage.
        G.damagePlayer(22, 'run over by a cop car');
        car.speed *= 0.4;
      }
    } else {
      // Foot cop chases the player on foot.
      const dx = G.player.x - cop.x;
      const dy = G.player.y - cop.y;
      const dist = Math.hypot(dx, dy);
      cop.angle = Math.atan2(dy, dx);
      if (G.player.car) {
        // Can't catch a car: fall back and wait.
        cop.bustTimer = 0;
      } else if (dist > BUST_RADIUS) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
        cop.bustTimer = 0;
      } else {
        cop.bustTimer += dt;
        if (cop.bustTimer > BUST_SECONDS) {
          G.busted();
          return;
        }
      }
      collideBuildings(G.city.buildings, cop, 12);
      clampToWorld(cop, 30);
    }
  }
  // Too many cops or wanted gone: retire the extras.
  if (G.wanted === 0) {
    for (const cop of [...G.cops]) {
      const px = cop.kind === 'car' ? cop.car.x : cop.x;
      const py = cop.kind === 'car' ? cop.car.y : cop.y;
      if (Math.hypot(px - G.player.x, py - G.player.y) > 900) removeCop(G, cop);
    }
  }
}

export function removeCop(G, cop) {
  const i = G.cops.indexOf(cop);
  if (i >= 0) G.cops.splice(i, 1);
  if (cop.kind === 'car') {
    const j = G.cars.indexOf(cop.car);
    if (j >= 0) G.cars.splice(j, 1);
  }
}
