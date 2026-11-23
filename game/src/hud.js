// HUD, minimap, banners, dialogs and every menu screen — all drawn on the
// same canvas so screenshots show the full game, not a DOM overlay.
import { WORLD, ROADS_X, ROADS_Y, PALETTE, FONT, PISTOL } from './config.js';
import { formatClock, districtAt } from './world.js';
import { currentStep, missionTarget, MISSIONS } from './missions.js';

function drawStarPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStars(ctx, x, y, wanted) {
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
    drawStarPath(ctx, x + 12 + i * 28, y - 8, 11);
    ctx.fill();
  }
}

export function drawMinimap(ctx, G) {
  const mw = 230; const mh = 168;
  const x0 = 1280 - mw - 16; const y0 = 16;
  const sx = mw / WORLD.width; const sy = mh / WORLD.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10,13,20,0.82)';
  ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath(); ctx.rect(x0, y0, mw, mh); ctx.clip();
  ctx.fillStyle = '#2f6b3a';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#1f7fa8';
  ctx.fillRect(x0 + 4900 * sx, y0, mw - 4900 * sx, mh);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0 + 4740 * sx, y0, (4900 - 4740) * sx, mh);
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 3;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke(); }
  ctx.fillStyle = '#ffd94d';
  for (const s of G.city.shops) ctx.fillRect(x0 + s.x * sx - 2, y0 + s.y * sy - 2, 4, 4);
  const target = missionTarget(G);
  if (target) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 8, 0, 7); ctx.stroke();
  }
  ctx.fillStyle = '#ff5a4d';
  for (const cop of G.cops) {
    const cx = cop.kind === 'car' ? cop.car.x : cop.x;
    const cy = cop.kind === 'car' ? cop.car.y : cop.y;
    ctx.beginPath(); ctx.arc(x0 + cx * sx, y0 + cy * sy, 3.5, 0, 7); ctx.fill();
  }
  // Player arrow, rotated to face travel direction.
  ctx.save();
  ctx.translate(x0 + G.player.x * sx, y0 + G.player.y * sy);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText(districtAt(G.player.x, G.player.y).toUpperCase(), 1280 - 16, y0 + mh + 24);
  ctx.fillText(formatClock(G.hour), 1280 - 16, y0 + mh + 42);
}

export function drawHUD(ctx, G) {
  ctx.save();
  // Top-left cluster: cash, health, wanted.
  ctx.fillStyle = 'rgba(10,13,20,0.72)';
  ctx.beginPath(); ctx.roundRect(14, 14, 300, 96, 10); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.money;
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillText(`$${G.money.toLocaleString('en-US')}`, 28, 50);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '13px ' + FONT;
  ctx.fillText(`Milo Reyes  •  ${G.stats.missions}/${MISSIONS.length} missions`, 28, 72);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(28, 80, 150, 10);
  ctx.fillStyle = G.player.health > 30 ? '#7ee081' : '#ff5a4d';
  ctx.fillRect(28, 80, 150 * Math.max(0, G.player.health) / 100, 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText(`HP ${Math.max(0, Math.ceil(G.player.health))}`, 186, 89);
  drawStars(ctx, 28, 140, G.wanted);
  if (G.player.car) {
    ctx.fillStyle = 'rgba(10,13,20,0.72)';
    ctx.beginPath(); ctx.roundRect(14, 152, 200, 52, 10); ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText(`${Math.round(Math.abs(G.player.car.speed) * 0.22)} km/h`, 28, 176);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${G.player.car.model.name}  •  ${Math.max(0, Math.ceil(G.player.car.health / 2))}%`, 28, 196);
  } else {
    ctx.fillStyle = 'rgba(10,13,20,0.72)';
    ctx.beginPath(); ctx.roundRect(14, 152, 220, 52, 10); ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText(G.player.weapon === 'pistol' ? `🔫 Pistol  ${G.player.ammo}/${PISTOL.magSize}` : '👊 Fists  (Q to draw pistol)', 28, 174);
    ctx.font = '12px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Click to shoot  •  Space to punch', 28, 196);
  }
  drawMinimap(ctx, G);

  // Mission objective, bottom-left.
  const step = currentStep(G);
  if (step && G.mission) {
    ctx.fillStyle = 'rgba(10,13,20,0.78)';
    const label = G.mission.def.title;
    ctx.font = 'bold 15px ' + FONT;
    const w = Math.max(ctx.measureText(step.text).width, ctx.measureText(label).width) + 36;
    ctx.beginPath(); ctx.roundRect(14, 720 - 92, w, 78, 10); ctx.fill();
    ctx.fillStyle = PALETTE.mission;
    ctx.textAlign = 'left';
    ctx.fillText(`◆ ${label}`, 28, 720 - 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '14px ' + FONT;
    ctx.fillText(step.text, 28, 720 - 40);
    if (G.mission.timer > 0) {
      ctx.fillStyle = G.mission.timer < 30 ? '#ff5a4d' : PALETTE.text;
      ctx.font = 'bold 14px ' + FONT;
      ctx.fillText(`⏱ ${Math.ceil(G.mission.timer)}s`, 28, 720 - 20);
    }
    if (step.type === 'hold') {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(28, 720 - 14, 160 * (G.mission.hold / step.seconds), 6);
    }
  }
  // Controls hint, bottom-right.
  ctx.fillStyle = 'rgba(10,13,20,0.6)';
  ctx.font = '12px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WASD move/drive  •  E enter car  •  P pause  •  M sound', 1280 - 16, 720 - 16);

  // Banner.
  if (G.bannerText && G.bannerTimer > 0) {
    ctx.globalAlpha = Math.min(1, G.bannerTimer);
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.bannerText).width + 50;
    ctx.fillStyle = 'rgba(10,13,20,0.85)';
    ctx.beginPath(); ctx.roundRect(640 - w / 2, 96, w, 52, 10); ctx.fill();
    ctx.fillStyle = G.bannerColor || PALETTE.text;
    ctx.fillText(G.bannerText, 640, 132);
    ctx.globalAlpha = 1;
  }
  // Dialog (mission briefing).
  if (G.mission?.dialog && G.mission.dialogTimer > 0) {
    ctx.fillStyle = 'rgba(10,13,20,0.88)';
    ctx.beginPath(); ctx.roundRect(240, 720 - 190, 800, 84, 12); ctx.fill();
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.mission;
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(G.mission.def.giver.toUpperCase(), 264, 720 - 160);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    wrapText(ctx, G.mission.dialog, 264, 720 - 136, 752, 20);
  }
  ctx.restore();
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

function panel(ctx, title, lines, footer) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = 'rgba(16,19,26,0.95)';
  ctx.beginPath(); ctx.roundRect(290, 110, 700, 500, 16); ctx.fill();
  ctx.strokeStyle = PALETTE.mission;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.mission;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText(title, 640, 180);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '17px ' + FONT;
  let y = 230;
  for (const line of lines) {
    ctx.fillText(line, 640, y);
    y += 30;
  }
  if (footer) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px ' + FONT;
    ctx.fillText(footer, 640, 560);
  }
}

export function drawTitle(ctx, G, best) {
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, 1280, 720);
  // Sunset gradient sky over the bay.
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#2a1e4a');
  grad.addColorStop(0.45, '#c65a3d');
  grad.addColorStop(0.7, '#f2a65a');
  grad.addColorStop(1, '#1f7fa8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath(); ctx.arc(980, 300, 70, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(20,20,30,0.9)';
  for (let i = 0; i < 14; i += 1) {
    const bx = 60 + i * 88;
    const bh = 120 + ((i * 53) % 180);
    ctx.fillRect(bx, 560 - bh, 62, bh);
    ctx.fillStyle = 'rgba(255,217,77,0.8)';
    for (let w = 0; w < 3; w += 1) ctx.fillRect(bx + 10 + w * 18, 560 - bh + 16, 8, 10);
    ctx.fillStyle = 'rgba(20,20,30,0.9)';
  }
  ctx.fillStyle = '#1f7fa8';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 560, 1280, 4);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px ' + FONT;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR BAY', 640, 170);
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('an open-world crime story', 640, 215);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '17px ' + FONT;
  ctx.fillText('Milo Reyes is out — and Lena Cruz owns his debt. Steal cars, outrun the', 640, 300);
  ctx.fillText('Solmar Bay PD, and pull the biggest score the city has ever seen.', 640, 326);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillText(G.hasSave ? '▶  Press ENTER to Continue' : '▶  Press ENTER to Start', 640, 420);
  ctx.fillStyle = '#fff';
  ctx.font = '15px ' + FONT;
  ctx.fillText('WASD move / drive   •   E steal & enter car   •   Click shoot   •   Space punch', 640, 470);
  ctx.fillText('Shift run   •   Q switch weapon   •   P pause   •   M sound', 640, 496);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px ' + FONT;
  ctx.fillText('6 story missions  •  wanted levels & police chases  •  traffic & pedestrians', 640, 540);
  ctx.fillText('15 hidden packages  •  day & night  •  progress saves automatically', 640, 562);
  if (best > 0) ctx.fillText(`Best haul so far: $${best.toLocaleString('en-US')}`, 640, 600);
  ctx.fillText('An original game. No assets, names or music from any commercial game.', 640, 660);
}

export function drawPaused(ctx, G) {
  panel(ctx, 'PAUSED', [
    'The city waits for no one — except now.',
    '',
    `Cash: $${G.money.toLocaleString('en-US')}    Missions: ${G.stats.missions}/${MISSIONS.length}`,
    `Cars stolen: ${G.stats.carsStolen}    Hidden packages: ${G.stats.packages}/${15}`,
  ], 'P / Esc resume  •  progress saves automatically');
}

export function drawOver(ctx, G, kind) {
  const title = kind === 'busted' ? 'BUSTED!' : kind === 'wasted' ? 'WASTED' : 'KING OF SOLMAR BAY';
  const lines = kind === 'busted'
    ? ['The Solmar Bay PD finally caught up with Milo.', `You kept $${Math.floor(G.money * 0.5).toLocaleString('en-US')} — the rest went to bail.`, `Missions done: ${G.stats.missions}/${MISSIONS.length}`]
    : kind === 'wasted'
      ? ['Milo didn\'t make it out of that one.', 'St. Mercy patched him up — for a fee.', `Missions done: ${G.stats.missions}/${MISSIONS.length}`]
      : ['Every mission complete. The Big Score is yours.', `Final haul: $${G.money.toLocaleString('en-US')}`, 'Solmar Bay will never forget Milo Reyes.'];
  panel(ctx, title, lines, 'Press ENTER to play again');
}
