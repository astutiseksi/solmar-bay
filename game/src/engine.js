// The simulation step: one fixed 1/60 s tick of Solmar Bay. The main loop
// calls it with real input; the screenshot stager calls it with a scripted
// autopilot, so every screenshot is a real moment of the real game.
import { PLAYER, PISTOL, CAR, START_HOUR, DAY_LENGTH_SECONDS } from './config.js';
import { collideBuildings, clampToWorld } from './world.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_WEAPON, ACTION_MUTE } from './input.js';
import { updatePlayerCar, collideCars, nearestCar, updateTrafficCar } from './vehicles.js';
import { updatePeds, scarePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { shoot, punch, updateBullets } from './combat.js';
import { updateMission } from './missions.js';

export function stepGame(G, dt, input) {
  G.time += dt;
  G.hour = (START_HOUR + (G.time / DAY_LENGTH_SECONDS) * 24) % 24;
  if (G.bannerTimer > 0) G.bannerTimer -= dt;
  if (G.mission?.dialogTimer > 0) G.mission.dialogTimer -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 28);
  if (G.muzzle > 0) G.muzzle -= dt;
  const p = G.player;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) p.ammo = PISTOL.magSize;
  }

  const actions = input.actions || 0;
  if (actions & ACTION_MUTE) { const m = G.audio.toggleMute(); G.banner(m ? 'Sound off' : 'Sound on', '#f5f1e8'); }
  if (actions & ACTION_WEAPON) {
    p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';
    G.banner(p.weapon === 'pistol' ? 'Pistol drawn' : 'Fists', '#f5f1e8');
  }
  if (actions & ACTION_RELOAD && p.weapon === 'pistol' && p.ammo < PISTOL.magSize) p.reloadTimer = PISTOL.reload;

  // --- Player ---
  const ax = input.axis || { x: 0, y: 0 };
  if (p.car) {
    const car = p.car;
    const drive = {
      throttle: -ax.y,
      steer: ax.x,
      handbrake: !!(actions & ACTION_PUNCH) || input.isDown?.('Space'),
    };
    const prevX = car.x; const prevY = car.y;
    updatePlayerCar(G, car, drive, dt);
    collideCars(G, car);
    G.stats.distance += Math.hypot(car.x - prevX, car.y - prevY);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (actions & ACTION_ENTER) G.exitCar(false);
    G.audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
  } else {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(ax.x, ax.y);
    if (len > 0) {
      const nx = ax.x / len; const ny = ax.y / len;
      p.x += nx * speed * dt;
      p.y += ny * speed * dt;
      p.angle = Math.atan2(ny, nx);
      G.stats.distance += speed * dt;
    }
    collideBuildings(G.city.buildings, p, PLAYER.radius);
    clampToWorld(p, 30);
    if (actions & ACTION_ENTER) {
      const car = nearestCar(G, 78);
      if (car) G.enterCar(car);
    }
    if (actions & ACTION_PUNCH) punch(G);
    if (input.mouseDown && p.weapon === 'pistol') shoot(G);
    if (p.ammo === 0 && p.reloadTimer <= 0) p.reloadTimer = PISTOL.reload;
    G.audio.setEngine(0, false);
    // Bumping a pedestrian with a sprint hurts them — and the law notices.
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && input.run && len > 0 && Math.hypot(ped.x - p.x, ped.y - p.y) < 22) {
        ped.state = 'flee'; ped.panic = 2; ped.fleeX = p.x; ped.fleeY = p.y;
        G.commitCrime(1, 'shoving a pedestrian');
      }
    }
  }

  // Aim follows the mouse (on foot).
  if (input.aimWorld) G.aimWorld = input.aimWorld;

  // --- World systems ---
  for (const car of G.cars) if (car.traffic) updateTrafficCar(G, car, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateMission(G, dt);

  // Pickups: cash dropped by the unlucky, health at the hospital.
  for (const pk of [...G.pickups]) {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      G.money += pk.amount;
      G.banner(`+$${pk.amount}`, '#7ee081');
      G.audio.cash();
      G.pickups.splice(G.pickups.indexOf(pk), 1);
    }
  }
  for (const c of G.city.collectibles) {
    if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < 30) {
      c.taken = true;
      G.money += 100;
      G.stats.packages += 1;
      G.banner(`Hidden package found! +$100 (${G.stats.packages}/15)`, '#ffd94d');
      G.audio.cash();
      G.saveGame();
    }
  }
  const hospital = G.city.shops.find((s) => s.type === 'hospital');
  if (hospital && Math.hypot(p.x - hospital.x, p.y - hospital.y) < 90 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 12 * dt);
  }
  const garage = G.city.shops.find((s) => s.type === 'garage');
  if (garage && Math.hypot(p.x - garage.x, p.y - garage.y) < 90) p.ammo = PISTOL.magSize;

  // Particles.
  for (const pt of [...G.particles]) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(G.particles.indexOf(pt), 1);
  }

  // Camera follows the player.
  G.camera.x += (p.x - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (p.y - G.camera.y) * Math.min(1, dt * 5);
  G.audio.setSiren(G.wanted > 0);
}
