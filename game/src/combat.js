// Combat: fists, the pistol, bullets, explosions and the particles that
// sell them. Crime committed in front of nobody still counts when it is
// loud — gunfire always raises the heat.
import { PISTOL, PLAYER } from './config.js';
import { scarePeds } from './pedestrians.js';

export function shoot(G) {
  const p = G.player;
  if (p.weapon !== 'pistol' || p.ammo <= 0 || p.shootCooldown > 0) return;
  p.ammo -= 1;
  p.shootCooldown = PISTOL.cooldown;
  const aim = Math.atan2(G.aimWorld.y - p.y, G.aimWorld.x - p.x);
  p.angle = aim;
  G.bullets.push({
    x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20,
    vx: Math.cos(aim) * 900, vy: Math.sin(aim) * 900,
    life: PISTOL.range / 900, damage: PISTOL.damage, fromPlayer: true,
  });
  G.audio.shoot();
  G.addParticles(p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, 3, '#ffe08a');
  G.muzzle = 0.06;
  if (G.wanted < 2) G.commitCrime(1, 'gunfire');
  scarePeds(G, p.x, p.y, 420);
}

export function punch(G) {
  const p = G.player;
  if (p.punchCooldown > 0 || p.car) return;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.18;
  G.audio.punch();
  let hitAnyone = false;
  const tryHit = (e, radius) => {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < PLAYER.punchRange + radius) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(a) * 26; e.y += Math.sin(a) * 26;
      hitAnyone = true;
      return true;
    }
    return false;
  };
  for (const ped of G.peds) {
    if (ped.state !== 'dead' && tryHit(ped, 12)) {
      ped.state = 'flee'; ped.panic = 3; ped.fleeX = p.x; ped.fleeY = p.y;
      ped.health = (ped.health ?? 100) - PLAYER.punchDamage;
      if (ped.health <= 0) killPed(G, ped);
      else G.commitCrime(1, 'assault');
    }
  }
  for (const cop of G.cops) {
    if (cop.kind === 'foot' && tryHit(cop, 12)) {
      cop.x += Math.cos(p.angle) * 10; cop.y += Math.sin(p.angle) * 10;
      G.commitCrime(1, 'assaulting an officer');
    }
  }
  for (const car of G.cars) {
    if (!car.dead && tryHit(car, 22)) { car.health -= 5; G.addParticles(car.x, car.y, 4, '#cfc8b8'); }
  }
  if (!hitAnyone) G.addParticles(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 2, '#ffffff');
}

export function killPed(G, ped) {
  ped.state = 'dead';
  G.stats.kills += 1;
  G.addParticles(ped.x, ped.y, 12, '#c0392b');
  G.commitCrime(1, 'a pedestrian was hurt');
  scarePeds(G, ped.x, ped.y, 380);
}

export function updateBullets(G, dt) {
  for (const b of [...G.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Buildings stop bullets.
      const hitB = G.city.buildings.find((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h);
      if (hitB) { G.addParticles(b.x, b.y, 4, '#d8c9a0'); dead = true; }
    }
    if (!dead && b.fromPlayer) {
      for (const ped of G.peds) {
        if (ped.state !== 'dead' && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.health = (ped.health ?? 100) - b.damage;
          G.addParticles(ped.x, ped.y, 6, '#c0392b');
          if (ped.health <= 0) killPed(G, ped);
          else { ped.state = 'flee'; ped.panic = 3; ped.fleeX = G.player.x; ped.fleeY = G.player.y; G.commitCrime(1, 'shooting'); }
          dead = true; break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const cop of G.cops) {
        if (cop.kind === 'foot' && Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          G.addParticles(cop.x, cop.y, 6, '#1c2f5e');
          G.commitCrime(2, 'shooting a cop');
          dead = true; break;
        }
        if (cop.kind === 'car' && Math.hypot(cop.car.x - b.x, cop.car.y - b.y) < 26) {
          cop.car.health -= b.damage;
          G.addParticles(b.x, b.y, 5, '#ffd94d');
          G.commitCrime(1, 'shooting at police');
          dead = true; break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const car of G.cars) {
        if (!car.dead && car !== G.player.car && Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.health -= b.damage;
          G.addParticles(b.x, b.y, 5, '#ffd94d');
          if (car.health <= 0 && !car.dead) { car.dead = true; G.explode(car.x, car.y); }
          dead = true; break;
        }
      }
    }
    if (dead) {
      const i = G.bullets.indexOf(b);
      if (i >= 0) G.bullets.splice(i, 1);
    }
  }
  // Cop return fire when the player is wanted and on foot nearby.
  G.copShootTimer -= dt;
  if (G.wanted >= 2 && !G.player.car && G.copShootTimer <= 0) {
    const shooter = G.cops.find((c) => c.kind === 'foot' && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 420);
    if (shooter) {
      G.copShootTimer = 1.4;
      const a = Math.atan2(G.player.y - shooter.y, G.player.x - shooter.x) + (G.rng.next() - 0.5) * 0.3;
      G.bullets.push({ x: shooter.x, y: shooter.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, life: 0.6, damage: 12, fromPlayer: false });
      G.audio.shoot();
    }
  }
  // Enemy bullets hitting the player.
  for (const b of [...G.bullets]) {
    if (!b.fromPlayer && Math.hypot(b.x - G.player.x, b.y - G.player.y) < 14) {
      G.damagePlayer(b.damage, 'shot');
      const i = G.bullets.indexOf(b);
      if (i >= 0) G.bullets.splice(i, 1);
    }
  }
}

export function explodeAt(G, x, y) {
  G.addParticles(x, y, 34, '#ff8a3d');
  G.addParticles(x, y, 20, '#3a3d46');
  G.addParticles(x, y, 12, '#ffd94d');
  G.shake = Math.max(G.shake, 12);
  G.audio.crash();
  scarePeds(G, x, y, 500);
  if (Math.hypot(G.player.x - x, G.player.y - y) < 120) G.damagePlayer(35, 'caught in an explosion');
  for (const car of G.cars) {
    if (!car.dead && Math.hypot(car.x - x, car.y - y) < 130) {
      car.health -= 60;
      if (car.health <= 0) { car.dead = true; G.addParticles(car.x, car.y, 16, '#ff8a3d'); }
    }
  }
}
