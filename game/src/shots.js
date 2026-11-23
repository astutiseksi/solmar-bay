// The screenshot scenes behind ?shot=start|play|chase|heist. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so every frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP, ROADS_X, ROADS_Y } from './config.js';
import { startMission, missionTarget } from './missions.js';
import { stepGame } from './engine.js';
import { nearestCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

/** Manhattan route along the street grid: nearest road, then one turn. */
function routeTo(G, tx, ty) {
  const n = nearestRoadPoint(G.player.x, G.player.y);
  const vx = ROADS_X.reduce((a, b) => (Math.abs(b - tx) < Math.abs(a - tx) ? b : a));
  const hy = ROADS_Y.reduce((a, b) => (Math.abs(b - ty) < Math.abs(a - ty) ? b : a));
  const pts = [{ x: n.x, y: n.y }];
  if (n.axis === 'h') { pts.push({ x: vx, y: n.y }); pts.push({ x: vx, y: hy }); }
  else { pts.push({ x: n.x, y: hy }); pts.push({ x: vx, y: hy }); }
  pts.push({ x: tx, y: ty });
  return pts;
}

function makeAutopilot(G) {
  let waypoints = null;
  let wpIndex = 0;
  return () => {
    const p = G.player;
    const target = missionTarget(G);
    const tx = target ? target.x : 2220;
    const ty = target ? target.y : 1460;
    if (!waypoints || Math.hypot(tx - waypoints[waypoints.length - 1].x, ty - waypoints[waypoints.length - 1].y) > 120) {
      waypoints = routeTo(G, tx, ty);
      wpIndex = 0;
    }
    while (wpIndex < waypoints.length - 1 && Math.hypot(waypoints[wpIndex].x - p.x, waypoints[wpIndex].y - p.y) < 80) wpIndex += 1;
    const wp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) return { axis: { x: 0, y: 0 }, run: false, actions: 0, mouseDown: false };
    if (p.car) {
      const want = Math.atan2(dy, dx);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const throttle = Math.abs(diff) > 1.1 ? 0.25 : 1;
      return { axis: { x: Math.max(-1, Math.min(1, diff * 2.4)), y: -throttle }, run: false, actions: 0, mouseDown: false };
    }
    return { axis: { x: dx / dist, y: dy / dist }, run: true, actions: 0, mouseDown: false };
  };
}

function driveFor(G, seconds, wantCar) {
  const pilot = makeAutopilot(G);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (wantCar && !G.player.car) {
      const car = nearestCar(G, 400);
      if (car) G.enterCar(car);
    }
    stepGame(G, STEP, pilot());
    if (G.screen !== 'play') break;
  }
}

function putPlayerInCar(G, x, y) {
  G.player.x = x; G.player.y = y;
  const car = nearestCar(G, 10000);
  if (car) { car.x = x; car.y = y; car.angle = 0; G.enterCar(car); }
}

export function stageShot(name, G) {
  G.reset();
  G.screen = 'play';
  if (name === 'chase') {
    // Mission 4: three stars, cop cars closing in, racing for the safehouse.
    putPlayerInCar(G, 2820, 2000);
    startMission(G, 3);
    G.wanted = 3;
    driveFor(G, 8, false);
    G.banner('LOSE THE COPS — reach the safehouse!', '#ff5a4d');
    return { screen: 'play' };
  }
  if (name === 'heist') {
    // Mission 6 at the bank: vault cracked, alarm up, four stars.
    putPlayerInCar(G, 1020, 460);
    startMission(G, 5);
    G.mission.step = 2; // past the vault hold: alarm raised
    G.wanted = 4;
    G.money = 12480;
    G.stats.missions = 5;
    driveFor(G, 8, false);
    G.banner('THE BIG SCORE — escape to the safehouse!', '#ffd94d');
    return { screen: 'play' };
  }
  if (name === 'play') {
    // Mission 1: fresh wheels, driving downtown with the minimap and HUD live.
    putPlayerInCar(G, 420, 920);
    startMission(G, 0);
    G.money = 1240;
    driveFor(G, 3.5, false);
    return { screen: 'play' };
  }
  // start: title over a living city.
  G.screen = 'title';
  for (let i = 0; i < 5 / STEP; i += 1) {
    G.time += STEP;
    G.hour = (17.2 + (G.time / 480) * 24) % 24;
    G.camera.x = 2400 + Math.sin(G.time / 20) * 420;
    G.camera.y = 1600 + Math.cos(G.time / 26) * 320;
  }
  return { screen: 'title' };
}
