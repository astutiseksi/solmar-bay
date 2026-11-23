// render.js — draws the whole world on one canvas: sea, beach, roads,
// buildings with lit windows, park, shops, cars, people, bullets, particles,
// the player, headlights and the night overlay.

import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { darknessAt } from './world.js';

export function drawWorld(S, ctx, view) {
  const { cam, cw, ch } = view;
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + (S.shakeX || 0), -cam.y + (S.shakeY || 0));

  drawGround(S, ctx, cam, cw, ch);
  drawBuildings(S, ctx, cam, cw, ch);
  drawShops(S, ctx);
  drawPackages(S, ctx);
  drawCars(S, ctx);
  drawPeds(S, ctx);
  drawCops(S, ctx);
  drawBullets(S, ctx);
  drawParticles(S, ctx);
  drawPlayer(S, ctx);
  drawMissionMarker(S, ctx);
  ctx.restore();

  // Night overlay + headlights, drawn in screen space.
  const dark = darknessAt(S.clock);
  if (dark > 0.02) {
    ctx.save();
    ctx.fillStyle = `rgba(8, 10, 34, ${dark * 0.55})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    drawHeadlights(S, ctx, view);
  }
}

function inView(cam, cw, ch, x, y, m = 120) {
  const hw = cw / 2 / cam.zoom + m, hh = ch / 2 / cam.zoom + m;
  return x > cam.x - hw && x < cam.x + hw && y > cam.y - hh && y < cam.y + hh;
}

function drawGround(S, ctx, cam, cw, ch) {
  const W = S.world;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(WORLD.beachX, 0, WORLD.w - WORLD.beachX, WORLD.h);
  // Sea with animated waves, then sand.
  const t = S.time * 0.7;
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(0, 0, W.sea.w, WORLD.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD.h; y += 130) {
    ctx.beginPath();
    for (let x = 0; x <= W.sea.w; x += 14) ctx.lineTo(x, y + Math.sin(x * 0.05 + t + y) * 5);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(W.beach.x, 0, W.beach.w, WORLD.h);
  // Park.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(W.park.x, W.park.y, W.park.w, W.park.h);
  // Piers.
  ctx.fillStyle = '#6a5136';
  for (const pier of W.piers) ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const x of W.roadsV) ctx.fillRect(x - WORLD.roadHalf, 0, WORLD.roadHalf * 2, WORLD.h);
  for (const y of W.roadsH) ctx.fillRect(0, y - WORLD.roadHalf, WORLD.w, WORLD.roadHalf * 2);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const x of W.roadsV) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); }
  for (const y of W.roadsH) { ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalks (lighter strips along roads).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const x of W.roadsV) { ctx.fillRect(x - WORLD.roadHalf - 14, 0, 10, WORLD.h); ctx.fillRect(x + WORLD.roadHalf + 4, 0, 10, WORLD.h); }
  for (const y of W.roadsH) { ctx.fillRect(0, y - WORLD.roadHalf - 14, WORLD.w, 10); ctx.fillRect(0, y + WORLD.roadHalf + 4, WORLD.w, 10); }
  // Trees and palms.
  for (const tr of W.trees) {
    if (!inView(cam, cw, ch, tr.x, tr.y)) continue;
    ctx.fillStyle = '#5a4028';
    ctx.fillRect(tr.x - 2, tr.y - 2, 4, 10);
    ctx.fillStyle = tr.palm ? PALETTE.palm : PALETTE.tree;
    ctx.beginPath(); ctx.arc(tr.x, tr.y - 6, tr.palm ? 12 : 10, 0, Math.PI * 2); ctx.fill();
  }
  // Lamps.
  ctx.fillStyle = PALETTE.lamp;
  for (const l of W.lamps) {
    if (!inView(cam, cw, ch, l.x, l.y)) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }
  // District labels on the ground.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
}

function drawBuildings(S, ctx, cam, cw, ch) {
  for (const b of S.world.buildings) {
    if (!inView(cam, cw, ch, b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    for (const win of b.lit) {
      ctx.fillStyle = (S.clock > 18 * 60 || S.clock < 6 * 60) ? PALETTE.windowLit : PALETTE.windowDark;
      ctx.fillRect(b.x + win.dx, b.y + win.dy, 12, 10);
    }
  }
}

function drawShops(S, ctx) {
  ctx.textAlign = 'center';
  for (const s of S.world.shops) {
    ctx.fillStyle = '#20242e';
    ctx.fillRect(s.x - 44, s.y - 26, 88, 26);
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(s.name.toUpperCase(), s.x, s.y - 8);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(s.kind === 'garage' ? 'AMMO • REPAIR' : s.kind, s.x, s.y + 12);
  }
}

function drawPackages(S, ctx) {
  for (const pk of S.world.packages) {
    if (pk.taken) continue;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5c00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 3);
  }
}

function drawCarShape(ctx, car) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 7);
  ctx.fill();
  ctx.fillStyle = '#1c2433';
  ctx.fillRect(-m.len * 0.18, -m.wid / 2 + 4, m.len * 0.32, m.wid - 8);
  ctx.fillStyle = '#d8e6ff';
  ctx.fillRect(m.len / 2 - 8, -m.wid / 2 + 3, 5, 6);
  ctx.fillRect(m.len / 2 - 8, m.wid / 2 - 9, 5, 6);
  if (car.brakeLight) { ctx.fillStyle = '#ff2d2d'; ctx.fillRect(-m.len / 2 + 1, -m.wid / 2 + 3, 4, 6); ctx.fillRect(-m.len / 2 + 1, m.wid / 2 - 9, 4, 6); }
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-m.len * 0.05, -m.wid / 2 + 2, m.len * 0.1, m.wid - 4);
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath(); ctx.arc(0, -m.wid / 2 + 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (car.taxi) {
    ctx.fillStyle = '#20242e';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
  if (car.hp < 45) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(car.x - 8, car.y - 6, 6 + Math.sin(performance.now() / 130) * 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCars(S, ctx) {
  for (const car of S.cars) if (!car.dead) drawCarShape(ctx, car);
}

function drawPeds(S, ctx) {
  for (const p of S.peds) {
    if (p.dead) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
    if (p.panic > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', -10, -12); }
    ctx.restore();
  }
}

function drawCops(S, ctx) {
  for (const c of S.cops) {
    if (c.dead) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = '#1d2f5e';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d6bff';
    ctx.fillRect(-4, -12, 8, 4);
    ctx.restore();
    if (c.bustT > 0) {
      ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y, 16, -Math.PI / 2, -Math.PI / 2 + (c.bustT / 1.4) * Math.PI * 2); ctx.stroke();
    }
  }
}

function drawBullets(S, ctx) {
  ctx.fillStyle = '#ffe27a';
  for (const b of S.bullets) ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
}

function drawParticles(S, ctx) {
  for (const pt of S.particles) {
    const a = 1 - pt.t / pt.life;
    if (pt.kind === 'flash') { ctx.fillStyle = `rgba(255,230,120,${a})`; ctx.beginPath(); ctx.arc(pt.x, pt.y, 14 * a + 4, 0, Math.PI * 2); ctx.fill(); }
    else if (pt.kind === 'spark') { ctx.fillStyle = `rgba(255,180,60,${a})`; ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4); }
    else if (pt.kind === 'smoke') { ctx.fillStyle = `rgba(140,140,140,${a * 0.6})`; ctx.beginPath(); ctx.arc(pt.x, pt.y, (pt.r || 10) * (1 + pt.t), 0, Math.PI * 2); ctx.fill(); }
    else if (pt.kind === 'boom') { ctx.fillStyle = `rgba(255,${120 + Math.floor(a * 100)},40,${a})`; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * (1.4 - a), 0, Math.PI * 2); ctx.fill(); }
    else if (pt.kind === 'poof') { ctx.fillStyle = `rgba(200,200,200,${a})`; ctx.beginPath(); ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawPlayer(S, ctx) {
  const p = S.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.inCar) { ctx.restore(); return; }
  ctx.rotate(p.aim);
  // Body + head, facing the aim direction.
  ctx.fillStyle = '#3a6fd8';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 16, 4);
  } else if (p.punching) {
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(18, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawMissionMarker(S, ctx) {
  const M = S.missions;
  if (!M.active || !M.marker) return;
  const m = M.marker;
  const bob = Math.sin(S.time * 4) * 6;
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 34 + bob);
  ctx.lineTo(m.x - 10, m.y - 56 + bob);
  ctx.lineTo(m.x + 10, m.y - 56 + bob);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,77,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(m.x, m.y, 26 + Math.sin(S.time * 3) * 4, 0, Math.PI * 2); ctx.stroke();
  // Off-screen arrow pointing at the marker.
  const view = S.view;
  if (view && (m.x < view.cam.x - view.cw / 2 / view.cam.zoom || m.x > view.cam.x + view.cw / 2 / view.cam.zoom ||
      m.y < view.cam.y - view.ch / 2 / view.cam.zoom || m.y > view.cam.y + view.ch / 2 / view.cam.zoom)) {
    const dx = m.x - view.cam.x, dy = m.y - view.cam.y, d = Math.hypot(dx, dy) || 1;
    const ex = view.cam.x + (dx / d) * (view.cw / 2 / view.cam.zoom - 30);
    const ey = view.cam.y + (dy / d) * (view.ch / 2 / view.cam.zoom - 30);
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHeadlights(S, ctx, view) {
  const p = S.player;
  if (!p.inCar || !p.car) return;
  const sx = view.cw / 2 + (p.car.x - view.cam.x) * view.cam.zoom;
  const sy = view.ch / 2 + (p.car.y - view.cam.y) * view.cam.zoom;
  const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
  g.addColorStop(0, 'rgba(255,240,180,0.28)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sx - 260, sy - 260, 520, 520);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
