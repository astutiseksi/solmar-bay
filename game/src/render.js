// The renderer: one canvas, a camera that follows the player, and the whole
// city painted in draw order — ground, roads, buildings, props, vehicles,
// people, bullets, particles — plus golden-hour light and night darkness.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, BEACH, SEA, HARBOUR, PALETTE, FONT } from './config.js';
import { daylight, districtAt } from './world.js';
import { missionTarget, currentStep } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * window.devicePixelRatio);
    canvas.height = Math.floor(h * window.devicePixelRatio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    offsetX = (canvas.width - VIEW_W * scale) / 2;
    offsetY = (canvas.height - VIEW_H * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function screenToWorld(G, sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const lx = ((sx - rect.left) * window.devicePixelRatio - offsetX) / scale;
    const ly = ((sy - rect.top) * window.devicePixelRatio - offsetY) / scale;
    return { x: G.camera.x + lx - VIEW_W / 2, y: G.camera.y + ly - VIEW_H / 2 };
  }

  function drawCarShape(c, isPlayer) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-34, -16, 68, 34);
    const len = c.model?.name === 'Van' ? 72 : 62;
    const wid = c.model?.name === 'Van' ? 34 : 30;
    ctx.fillStyle = '#14161c';
    ctx.fillRect(-len / 2 + 2, -wid / 2 - 3, 12, 7);
    ctx.fillRect(-len / 2 + 2, wid / 2 - 4, 12, 7);
    ctx.fillRect(len / 2 - 14, -wid / 2 - 3, 12, 7);
    ctx.fillRect(len / 2 - 14, wid / 2 - 4, 12, 7);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,24,34,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -wid / 2 + 4, 20, wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 3, 8, wid - 6);
    if (c.cop) {
      ctx.fillStyle = '#f5f1e8';
      ctx.fillRect(-6, -wid / 2, 12, wid);
      ctx.fillStyle = '#1c2f5e';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      const t = performance.now() / 240;
      ctx.fillStyle = Math.sin(t) > 0 ? '#ff3b30' : '#3b82ff';
      ctx.beginPath(); ctx.arc(-2, -wid / 2 + 2, 4, 0, 7); ctx.fill();
      ctx.fillStyle = Math.sin(t) > 0 ? '#3b82ff' : '#ff3b30';
      ctx.beginPath(); ctx.arc(10, -wid / 2 + 2, 4, 0, 7); ctx.fill();
    }
    if (c.taxi) {
      ctx.fillStyle = '#14161c';
      ctx.font = 'bold 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -wid / 2 - 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 9);
      ctx.stroke();
    }
    if (c.dead) {
      ctx.fillStyle = 'rgba(20,20,20,0.55)';
      ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, 7); ctx.fill();
    }
    ctx.restore();
    if (c.smoke) {
      ctx.fillStyle = 'rgba(90,90,90,0.5)';
      ctx.beginPath();
      ctx.arc(c.x - Math.cos(c.angle) * 26, c.y - Math.sin(c.angle) * 26, 6 + Math.sin(performance.now() / 90) * 2, 0, 7);
      ctx.fill();
    }
  }

  function drawPerson(p, isPlayer) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'dead') {
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(12, 0, 5, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    const bob = p.state === 'flee' ? Math.sin(performance.now() / 60) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, 7); ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.roundRect(-6, -7 + bob, 14, 15, 5); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(10, 0 + bob, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(11, -2 + bob, 5, Math.PI, 0); ctx.fill();
    if (isPlayer) {
      ctx.rotate(-p.angle);
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.stroke();
      if (p.weapon === 'pistol') {
        ctx.fillStyle = '#222';
        ctx.fillRect(14, -2, 12, 4);
      }
    }
    ctx.restore();
  }

  function drawWorld(G) {
    const cam = G.camera;
    const zoom = G.player.car ? 0.82 : 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * zoom, 0, 0, scale * zoom, offsetX + (canvas.width / 2 - offsetX) * 0 + (VIEW_W * scale) / 2 - cam.x * scale * zoom + offsetX - (VIEW_W * scale) / 2, 0);
    // Simpler: compute transform so camera centre maps to canvas centre.
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const shX = (G.shake ? (Math.random() - 0.5) * G.shake : 0) * scale;
    const shY = (G.shake ? (Math.random() - 0.5) * G.shake : 0) * scale;
    ctx.setTransform(scale * zoom, 0, 0, scale * zoom, cx - cam.x * scale * zoom + shX, cy - cam.y * scale * zoom + shY);

    const view = {
      x0: cam.x - VIEW_W / 2 / zoom - 60, x1: cam.x + VIEW_W / 2 / zoom + 60,
      y0: cam.y - VIEW_H / 2 / zoom - 60, y1: cam.y + VIEW_H / 2 / zoom + 60,
    };
    const inView = (x, y, m = 80) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;

    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // Park.
    const park = G.city.park;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    // Harbour water.
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(HARBOUR.x0, HARBOUR.y0, HARBOUR.x1 - HARBOUR.x0, HARBOUR.y1 - HARBOUR.y0);
    ctx.fillStyle = '#c8b280';
    ctx.fillRect(HARBOUR.x0, HARBOUR.y0 - 12, HARBOUR.x1 - HARBOUR.x0, 12);
    // Beach + sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH.x0, Math.max(view.y0, 0), BEACH.x1 - BEACH.x0, Math.min(view.y1, WORLD.height) - Math.max(view.y0, 0));
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(SEA.x0, Math.max(view.y0, 0), SEA.x1 - SEA.x0, Math.min(view.y1, WORLD.height) - Math.max(view.y0, 0));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      const wy = ((performance.now() / 1400 + i * 0.33) % 1) * WORLD.height;
      if (wy > view.y0 && wy < view.y1) {
        ctx.beginPath();
        ctx.moveTo(SEA.x0 - 14 + Math.sin(wy / 90) * 8, wy);
        ctx.lineTo(SEA.x0 + 60, wy);
        ctx.stroke();
      }
    }

    // Roads.
    for (const rx of ROADS_X) {
      if (rx < view.x0 - 60 || rx > view.x1 + 60) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(rx - ROAD_W / 2 - 14, view.y0, ROAD_W + 28, view.y1 - view.y0);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(rx - ROAD_W / 2, view.y0, ROAD_W, view.y1 - view.y0);
      ctx.strokeStyle = PALETTE.lane;
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 30]);
      ctx.beginPath(); ctx.moveTo(rx, view.y0); ctx.lineTo(rx, view.y1); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const ry of ROADS_Y) {
      if (ry < view.y0 - 60 || ry > view.y1 + 60) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(view.x0, ry - ROAD_W / 2 - 14, view.x1 - view.x0, ROAD_W + 28);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(view.x0, ry - ROAD_W / 2, view.x1 - view.x0, ROAD_W);
      ctx.strokeStyle = PALETTE.lane;
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 30]);
      ctx.beginPath(); ctx.moveTo(view.x0, ry); ctx.lineTo(view.x1, ry); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Buildings.
    for (const b of G.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3 + b.floors) % 4 === 0) continue;
        ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), 9, 11);
      }
    }
    // Shop labels.
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    for (const s of G.city.shops) {
      if (!inView(s.x, s.y, 40)) continue;
      ctx.fillStyle = 'rgba(16,19,26,0.75)';
      const w = ctx.measureText(s.label).width + 18;
      ctx.beginPath(); ctx.roundRect(s.x - w / 2, s.y - 34, w, 20, 5); ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(s.label, s.x, s.y - 20);
    }
    // Trees and palms.
    for (const t of [...G.city.trees, ...G.city.palms]) {
      if (!inView(t.x, t.y)) continue;
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(t.x, t.y - 6, t.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(t.x - 4, t.y - 10, t.r * 0.45, 0, 7); ctx.fill();
    }
    // Lamps.
    ctx.fillStyle = '#3a3d46';
    for (const l of G.city.lamps) if (inView(l.x, l.y)) ctx.fillRect(l.x - 2, l.y - 6, 4, 12);

    // Collectibles (hidden packages).
    for (const c of G.city.collectibles) {
      if (c.taken || !inView(c.x, c.y)) continue;
      const bob = Math.sin(performance.now() / 400 + c.bob) * 3;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a6d00';
      ctx.font = 'bold 12px ' + FONT;
      ctx.fillText('$', c.x, c.y + bob + 4);
    }
    // Mission crates.
    if (G.mission?.crates) {
      for (const c of G.mission.crates) {
        if (c.taken || !inView(c.x, c.y)) continue;
        ctx.fillStyle = '#b56b2a';
        ctx.fillRect(c.x - 12, c.y - 10, 24, 20);
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x - 12, c.y - 10, 24, 20);
      }
    }

    // Mission marker: pulsing beacon + ground ring.
    const target = missionTarget(G);
    if (target) {
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
      ctx.strokeStyle = PALETTE.mission;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(target.x, target.y, 34 * pulse, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,217,77,0.25)';
      ctx.beginPath(); ctx.arc(target.x, target.y, 30 * pulse, 0, 7); ctx.fill();
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 66);
      ctx.lineTo(target.x - 12, target.y - 44);
      ctx.lineTo(target.x + 12, target.y - 44);
      ctx.closePath(); ctx.fill();
    }

    // Cars (traffic under the player car, cop cars on top).
    for (const car of G.cars) if (!car.cop && inView(car.x, car.y, 60)) drawCarShape(car, car === G.player.car);
    for (const car of G.cars) if (car.cop && inView(car.x, car.y, 60)) drawCarShape(car, false);
    // Peds and foot cops.
    for (const p of G.peds) if (p.state !== 'dead' && inView(p.x, p.y, 40)) drawPerson(p, false);
    for (const p of G.peds) if (p.state === 'dead' && inView(p.x, p.y, 40)) drawPerson(p, false);
    for (const cop of G.cops) if (cop.kind === 'foot' && inView(cop.x, cop.y, 40)) drawPerson(cop, false);
    // Player.
    if (G.player.car) drawCarShape(G.player.car, true);
    else drawPerson(G.player, true);

    // Bullets.
    ctx.fillStyle = '#ffe08a';
    for (const b of G.bullets) {
      ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Muzzle flash.
    if (G.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,224,138,0.9)';
      ctx.beginPath();
      ctx.arc(G.player.x + Math.cos(G.player.angle) * 26, G.player.y + Math.sin(G.player.angle) * 26, 9, 0, 7);
      ctx.fill();
    }

    // Day/night light.
    const dl = daylight(G.hour);
    const dark = 1 - dl;
    if (dark > 0.03) {
      ctx.fillStyle = `rgba(8,12,34,${(dark * 0.55).toFixed(3)})`;
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      // Headlight cones at night.
      if (G.player.car) {
        const car = G.player.car;
        const grad = ctx.createRadialGradient(car.x + Math.cos(car.angle) * 90, car.y + Math.sin(car.angle) * 90, 10, car.x + Math.cos(car.angle) * 90, car.y + Math.sin(car.angle) * 90, 220);
        grad.addColorStop(0, 'rgba(255,240,180,0.28)');
        grad.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(car.x + Math.cos(car.angle) * 90, car.y + Math.sin(car.angle) * 90, 220, 0, 7); ctx.fill();
      }
    }
    // Golden-hour warm wash.
    if (G.hour > 16.5 && G.hour < 18.5) {
      ctx.fillStyle = 'rgba(255,150,60,0.08)';
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { scale, offsetX, offsetY };
  }

  return { drawWorld, screenToWorld, canvas, VIEW_W, VIEW_H };
}
