// hud.js — everything drawn in screen space: cash/health/wanted, speed and
// car condition, the live minimap, mission panel, banners, mission dialogs,
// and the title / pause / busted / wasted / won screens.

import { WORLD, DISTRICTS, TUNE, districtAt } from './config.js';
import { missionObjective } from './missions.js';

export function drawHud(S, ctx, cw, ch) {
  const p = S.player;
  // Top-right: cash, health bar, wanted stars.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1d2f1d';
  ctx.fillRect(cw - 250, 12, 238, 66);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), cw - 24, 38);
  ctx.fillStyle = '#333';
  ctx.fillRect(cw - 226, 48, 200, 10);
  ctx.fillStyle = p.hp > 30 ? '#7dff8a' : '#ff4d4d';
  ctx.fillRect(cw - 226, 48, 200 * (p.hp / TUNE.playerHp), 10);
  // Wanted stars, top-left under the objective.
  drawStars(ctx, 16, 66, p.wanted);
  // Objective panel, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(20,22,30,0.85)';
  const obj = missionObjective(S);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillRect(12, 12, Math.min(560, 24 + ctx.measureText(obj).width + 40), 44);
  ctx.fillStyle = '#ffd24d';
  ctx.fillText(obj, 22, 40);
  // Speed + car condition, bottom-right above the minimap.
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(20,22,30,0.85)';
    ctx.fillRect(cw - 190, ch - 158 - 76, 178, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(kmh + ' km/h', cw - 24, ch - 158 - 44);
    ctx.fillStyle = p.car.hp > 40 ? '#7dff8a' : '#ff4d4d';
    ctx.font = '13px sans-serif';
    ctx.fillText(p.car.model.name + '  •  ' + Math.max(0, Math.round(p.car.hp)) + '%', cw - 24, ch - 158 - 24);
  }
  // Weapon / ammo, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(20,22,30,0.85)';
  ctx.fillRect(12, ch - 52, 210, 40);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(p.weapon === 'pistol' ? 'PISTOL  ' + p.mag + ' / ' + p.ammo + (p.reloading ? '  reloading…' : '') : 'FISTS  (Q: pistol)', 22, ch - 26);
  // Banner (mission complete / failed).
  if (S.bannerT > 0 && S.missions.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,22,30,0.9)';
    const bw = ctx.measureText(S.missions.banner).width + 60;
    ctx.fillRect(cw / 2 - bw / 2, 96, bw, 40);
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(S.missions.banner, cw / 2, 122);
  }
  // Mission dialog box.
  if (S.missions.dialog) {
    const d = S.missions.dialog;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(16,18,28,0.92)';
    ctx.fillRect(cw / 2 - 300, ch - 190, 600, 110);
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(d.who + ' — ' + d.title, cw / 2 - 282, ch - 160);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, d.text, cw / 2 - 282, ch - 134, 564, 20);
    ctx.fillStyle = '#9aa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Press Enter to continue', cw / 2 - 282, ch - 96);
  }
  drawMinimap(S, ctx, cw, ch);
  // Controls hint, bottom-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move • E enter car • Q pistol • Space punch • R reload • P pause • M mute', cw / 2, ch - 8);
}

function drawStars(ctx, x, y, n) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd24d' : 'rgba(255,255,255,0.25)';
    star(ctx, x + i * 26 + 12, y, 11, 5);
  }
}

function star(ctx, cx, cy, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / points - Math.PI / 2;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

export function drawMinimap(S, ctx, cw, ch) {
  const mw = 200, mh = 146, mx = cw - mw - 12, my = ch - mh - 28;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = 'rgba(16,20,16,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);
  // Sea + roads.
  ctx.fillStyle = '#1f6f8f';
  ctx.fillRect(mx, my, 12, mh);
  ctx.strokeStyle = '#888';
  for (const x of S.world.roadsV) { ctx.beginPath(); ctx.moveTo(mx + x * sx, my); ctx.lineTo(mx + x * sx, my + mh); ctx.stroke(); }
  for (const y of S.world.roadsH) { ctx.beginPath(); ctx.moveTo(mx, my + y * sy); ctx.lineTo(mx + mw, my + y * sy); ctx.stroke(); }
  // Shops.
  ctx.fillStyle = '#ffd24d';
  for (const s of S.world.shops) ctx.fillRect(mx + s.x * sx - 2, my + s.y * sy - 2, 4, 4);
  // Mission marker.
  if (S.missions.active && S.missions.marker) {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(mx + S.missions.marker.x * sx, my + S.missions.marker.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Cop dots.
  ctx.fillStyle = '#ff2d2d';
  for (const c of S.cars) if (c.police && !c.dead) ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  // Player arrow.
  const px = mx + S.player.x * sx, py = my + S.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.player.inCar && S.player.car ? S.player.car.angle : S.player.aim);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // District + clock under the map.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  const hh = Math.floor(S.clock / 60) % 24, mm = Math.floor(S.clock % 60);
  ctx.fillText(districtAt(S.player.x, S.player.y) + '  •  ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), mx + mw / 2, my + mh + 14);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  ctx.fillText(line, x, y);
}

export function drawScreen(S, ctx, cw, ch) {
  const screen = S.screen;
  if (screen === 'play') return;
  ctx.fillStyle = 'rgba(10,12,22,0.82)';
  ctx.fillRect(0, 0, cw, ch);
  ctx.textAlign = 'center';
  if (screen === 'title') {
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR BAY', cw / 2, ch / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An original open-world crime story', cw / 2, ch / 2 - 70);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#cdd';
    ctx.fillText('Milo Reyes is back in town. Six missions. One crown.', cw / 2, ch / 2 - 38);
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(S.hasSave ? 'Press Enter — Continue ($' + S.saveMoney + ', mission ' + (S.saveMission + 1) + ')' : 'Press Enter — New Game', cw / 2, ch / 2 + 20);
    ctx.fillStyle = '#9aa';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD walk • Shift run • E steal / enter car • Q pistol • Space punch • R reload', cw / 2, ch / 2 + 60);
    ctx.fillText('Missions pay. Cops chase. The city never sleeps.', cw / 2, ch / 2 + 84);
  } else if (screen === 'pause') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', cw / 2, ch / 2 - 30);
    ctx.font = '16px sans-serif';
    ctx.fillText('Mission ' + (S.missions.index + 1) + ' of 6  •  $' + S.player.money + '  •  ' + S.player.hp + ' HP', cw / 2, ch / 2 + 10);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('Press P to resume — Enter restarts the current mission', cw / 2, ch / 2 + 44);
  } else if (screen === 'busted') {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('BUSTED', cw / 2, ch / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The Solmar Bay PD took $' + (S.bustedFine || 0) + ' in fines. You walk out of the hospital.', cw / 2, ch / 2 + 10);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('Press Enter to keep playing', cw / 2, ch / 2 + 48);
  } else if (screen === 'wasted') {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('WASTED', cw / 2, ch / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Milo wakes up in the hospital, $' + 150 + ' lighter. The city waits.', cw / 2, ch / 2 + 10);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('Press Enter to keep playing', cw / 2, ch / 2 + 48);
  } else if (screen === 'won') {
    ctx.fillStyle = '#ffd24d';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('KING OF SOLMAR BAY', cw / 2, ch / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Six missions. One crown. Milo Reyes owns this city now.', cw / 2, ch / 2 + 10);
    ctx.fillText('Final cash: $' + S.player.money, cw / 2, ch / 2 + 40);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('Press Enter to free-roam Solmar Bay', cw / 2, ch / 2 + 78);
  }
}
