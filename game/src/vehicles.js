// Vehicles: traffic that follows the street grid, parked cars to steal,
// and the arcade driving model for the player's car.
import { CAR, CAR_MODELS, ROADS_X, ROADS_Y, ROAD_W, LANE, WORLD } from './config.js';
import { collideBuildings, clampToWorld, isOnRoad } from './world.js';

let nextCarId = 1;

export function makeCar(rng, x, y, angle, opts = {}) {
  const model = opts.model || rng.pick(CAR_MODELS);
  return {
    id: nextCarId += 1,
    model, color: opts.color || model.color,
    x, y, angle, speed: 0,
    health: CAR.health,
    traffic: !!opts.traffic,
    taxi: model.name === 'Taxi',
    // traffic state: which road it follows, which way, how far along it
    axis: opts.axis || 'h', road: opts.road ?? ROADS_Y[0], dir: opts.dir || 1,
    cruise: rng ? rng.range(150, 260) : 200,
    stuck: 0, dead: false, smoke: 0,
  };
}

/** Parked cars along road edges plus moving traffic. */
export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < 22; i += 1) {
    const axis = rng.chance(0.5) ? 'h' : 'v';
    const road = axis === 'h' ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const dir = rng.chance(0.5) ? 1 : -1;
    const s = rng.range(200, axis === 'h' ? WORLD.width - 500 : WORLD.height - 300);
    const car = makeCar(rng, 0, 0, 0, { traffic: true, axis, road, dir });
    placeOnRoad(car, s);
    cars.push(car);
  }
  // Parked cars the player can steal.
  for (let i = 0; i < 14; i += 1) {
    const axis = rng.chance(0.5) ? 'h' : 'v';
    const road = axis === 'h' ? rng.pick(ROADS_Y) : rng.pick(ROADS_X);
    const s = rng.range(250, axis === 'h' ? WORLD.width - 600 : WORLD.height - 350);
    const car = makeCar(rng, 0, 0, 0, { traffic: false, axis, road, dir: 1 });
    const off = ROAD_W / 2 + 16;
    if (axis === 'h') { car.x = s; car.y = road + off; car.angle = 0; }
    else { car.x = road + off; car.y = s; car.angle = Math.PI / 2; }
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export function placeOnRoad(car, s) {
  const lane = car.dir > 0 ? LANE : -LANE;
  if (car.axis === 'h') { car.x = s; car.y = car.road + lane; car.angle = car.dir > 0 ? 0 : Math.PI; }
  else { car.x = car.road + lane; car.y = s; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
}

function roadEnd(car) {
  return car.axis === 'h' ? WORLD.width - 560 : WORLD.height - 220;
}

/** One traffic car: cruise along its road, turn at intersections sometimes,
 *  slow down for the car ahead, stop dead when wrecked. */
export function updateTrafficCar(G, car, dt) {
  if (car.dead || car.parked) return;
  const s = car.axis === 'h' ? car.x : car.y;
  // Car ahead on the same road and lane?
  let ahead = Infinity;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    if (o.axis !== car.axis || o.road !== car.road || o.dir !== car.dir) continue;
    const os = o.axis === 'h' ? o.x : o.y;
    const gap = (os - s) * car.dir;
    if (gap > 0 && gap < ahead) ahead = gap;
  }
  let target = car.cruise;
  if (ahead < 90) target = Math.max(0, (ahead - 55) * 3);
  if (G.player.car === car) target = 0;
  car.speed += Math.max(-500 * dt, Math.min(260 * dt, target - car.speed));
  const ns = s + car.dir * car.speed * dt;
  placeOnRoad(car, ns);
  // Intersection: sometimes turn onto the crossing road.
  const crossing = (car.axis === 'h' ? ROADS_X : ROADS_Y).find((r) => Math.abs(ns - r) < 6);
  if (crossing !== undefined && G.rng.chance(0.012)) {
    car.axis = car.axis === 'h' ? 'v' : 'h';
    car.road = crossing;
    car.dir = G.rng.chance(0.5) ? 1 : -1;
    placeOnRoad(car, crossing);
  }
  if (ns > roadEnd(car) || ns < 160) {
    car.dir *= -1;
    placeOnRoad(car, Math.max(170, Math.min(roadEnd(car) - 10, ns)));
  }
  collideBuildings(G.city.buildings, car, 24);
}

/** Arcade driving for the player's car. `drive` is {throttle:-1..1, steer:-1..1}. */
export function updatePlayerCar(G, car, drive, dt) {
  const model = car.model.speed || 1;
  const maxSpeed = CAR.maxSpeed * model;
  const moving = Math.abs(car.speed) > 12;
  if (drive.throttle > 0) car.speed += CAR.accel * model * drive.throttle * dt;
  else if (drive.throttle < 0) {
    car.speed += car.speed > 20 ? -CAR.brake * dt : CAR.reverseAccel * model * drive.throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  if (drive.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, car.speed));
  if (moving) {
    const steer = drive.steer * CAR.turn * (car.speed >= 0 ? 1 : -1) * (drive.handbrake ? 1.35 : 1);
    car.angle += steer * dt * Math.min(1, Math.abs(car.speed) / 140);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  const hit = collideBuildings(G.city.buildings, car, 22);
  if (hit && Math.abs(car.speed) > 260 && (!car.crashCd || car.crashCd <= 0)) {
    car.speed *= -0.25;
    car.health -= 3;
    car.crashCd = 0.8;
    G.audio.crash();
    G.addParticles(car.x, car.y, 10, '#ffb347');
    G.shake = Math.max(G.shake, 6);
  }
  if (car.crashCd > 0) car.crashCd -= dt;
  clampToWorld(car, 40);
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    G.explode(car.x, car.y);
    if (G.player.car === car) G.exitCar(true);
  }
  if (car.health < 40) car.smoke = 1;
}

/** Circle-circle shove between the player's car and traffic. */
export function collideCars(G, car) {
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x; const dy = o.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = 46;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d; const uy = dy / d;
      o.x += ux * push; o.y += uy * push;
      car.x -= ux * push * 0.5; car.y -= uy * push * 0.5;
      const impact = Math.abs(car.speed) + Math.abs(o.speed || 0);
      if (impact > 320) {
        car.health -= 2; o.health -= 4;
        G.audio.crash();
        G.addParticles((car.x + o.x) / 2, (car.y + o.y) / 2, 6, '#ffd94d');
        G.shake = Math.max(G.shake, 4);
        if (Math.abs(car.speed) > 240) G.commitCrime(1, 'crash');
      }
      car.speed *= 0.82;
      if (o.traffic) o.speed = Math.max(0, (o.speed || 0) * 0.4);
    }
  }
}

/** Nearest drivable car within reach of the player (for E to steal/enter). */
export function nearestCar(G, maxDist) {
  let best = null; let bd = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function isOnRoadPoint(x, y) { return isOnRoad(x, y); }
