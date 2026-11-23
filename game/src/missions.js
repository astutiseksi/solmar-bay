// missions.js — the six story missions, run as a small state machine.
// Each mission has a briefing, a sequence of steps with a marker position,
// and a payout. Steps complete by reaching markers, driving a taxi fare,
// collecting crates, or surviving a wanted level.

import { TUNE } from './config.js';
import { shopByKind } from './world.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';

const BRIEFINGS = [
  { title: '1 — Fresh Wheels', who: 'Lena Cruz', text: 'Milo, you need wheels. Steal any car on the street and bring it to the Garage. Keep it clean.' },
  { title: '2 — Package Run', who: 'Lena Cruz', text: 'Three drops, one clock. Deliver the packages to the markers before time runs out. Drive like you mean it.' },
  { title: '3 — Night Cab', who: 'Benny the Dispatcher', text: 'The cab is yours tonight. Pick up two fares waiting on the sidewalk and drop them where they point.' },
  { title: '4 — Hot Pursuit', who: 'Dante "The Crane"', text: 'The cops are onto you, Milo. Three stars. Lose them — outrun, hide, survive. No shortcuts.' },
  { title: '5 — The Harbor Job', who: 'Dante "The Crane"', text: 'Four crates on the docks, Harbor district. Grab them all and get back to the Safehouse. Quietly.' },
  { title: '6 — The Big Score', who: 'Lena Cruz', text: 'The Bank. Crack the vault, grab the score, and shake four stars. Do this and you are King of Solmar Bay.' },
];

export function createMissions(S) {
  return {
    index: 0, step: 0, timer: 0, active: false, done: false, won: false,
    marker: null, crates: [], fares: [], dialog: null, banner: null,
  };
}

export function startMission(S) {
  const M = S.missions;
  const def = BRIEFINGS[M.index];
  M.active = true; M.step = 0; M.dialog = { who: def.who, text: def.text, title: def.title };
  M.banner = def.title;
  S.audio.mission();
  setupMissionStep(S);
}

export function setupMissionStep(S) {
  const M = S.missions;
  const W = S.world;
  const garage = shopByKind(W, 'garage');
  const bank = shopByKind(W, 'bank');
  const docks = shopByKind(W, 'docks');
  const safehouse = shopByKind(W, 'safehouse');
  switch (M.index) {
    case 0: // Fresh Wheels: steal a car, then drive to the garage.
      M.marker = M.step === 0 ? null : { x: garage.x, y: garage.y, label: 'Garage' };
      break;
    case 1: // Package Run: 3 timed deliveries.
      M.timer = 150;
      M.marker = deliverySpot(S, M.step);
      break;
    case 2: // Night Cab: 2 fares.
      if (M.step === 0) spawnFare(S);
      break;
    case 3: // Hot Pursuit: gain 3 stars, then lose them.
      if (M.step === 0) { addWanted(S, 3); M.marker = null; }
      break;
    case 4: // Harbor Job: 4 crates near the docks.
      if (M.step === 0) {
        M.crates = [];
        for (let i = 0; i < 4; i++) M.crates.push({ x: docks.x + (i % 2) * 120 - 60, y: docks.y + 120 + Math.floor(i / 2) * 120, taken: false });
        M.marker = M.crates[0];
      }
      break;
    case 5: // Big Score: vault, then escape 4 stars.
      if (M.step === 0) { M.marker = { x: bank.x, y: bank.y, label: 'Bank vault' }; M.timer = 240; }
      break;
  }
}

function deliverySpot(S, step) {
  const spots = [
    shopByKind(S.world, 'diner'), shopByKind(S.world, 'motel'), shopByKind(S.world, 'hospital'),
  ];
  const s = spots[step % spots.length];
  return { x: s.x, y: s.y, label: 'Drop ' + (step + 1) + '/3' };
}

function spawnFare(S) {
  const M = S.missions;
  // A waiting ped near the player becomes the fare.
  const ped = S.peds.find((p) => !p.dead && !p.fare);
  if (!ped) return;
  ped.fare = true;
  ped.x = S.player.x + 140; ped.y = S.player.y + 80;
  const dest = pickDest(S);
  M.fares = [{ ped, dest, picked: false }];
  M.marker = { x: ped.x, y: ped.y, label: 'Fare — pick up' };
}

function pickDest(S) {
  const kinds = ['motel', 'diner', 'hospital', 'marina'];
  const shop = shopByKind(S.world, kinds[Math.floor(S.rng() * 3)]);
  return { x: shop.x + 60, y: shop.y + 60 };
}

export function completeMission(S) {
  const M = S.missions;
  const pay = TUNE.missionPayouts[M.index] || 200;
  S.player.money += pay;
  S.audio.cash();
  M.banner = 'Mission complete — +$' + pay;
  M.active = false; M.marker = null;
  M.index++;
  if (M.index >= BRIEFINGS.length) { M.won = true; S.screen = 'won'; S.audio.mission(); return; }
  M.step = 0;
  S.saveGame();
}

export function failMission(S, why) {
  const M = S.missions;
  M.active = false; M.marker = null; M.timer = 0;
  M.banner = 'Mission failed — ' + why;
  S.audio.fail();
  // Restart the same mission on demand: the player presses Enter at the banner.
  M.retry = true;
}

export function updateMissions(S, dt) {
  const M = S.missions;
  const p = S.player;
  if (!M.active || M.won) return;
  if (M.timer > 0) {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(S, 'out of time'); return; }
  }
  const near = (m, r) => m && Math.hypot(p.x - m.x, p.y - m.y) < r;
  switch (M.index) {
    case 0:
      if (M.step === 0 && p.inCar) { M.step = 1; setupMissionStep(S); }
      else if (M.step === 1 && near(M.marker, 90)) completeMission(S);
      break;
    case 1:
      if (near(M.marker, 80)) {
        M.step++;
        if (M.step >= 3) completeMission(S);
        else { S.player.money += 40; setupMissionStep(S); }
      }
      break;
    case 2: {
      const fare = M.fares[0];
      if (fare && !fare.picked && near({ x: fare.ped.x, y: fare.ped.y }, 60) && p.inCar) {
        fare.picked = true; fare.ped.dead = true;
        M.marker = { x: fare.dest.x, y: fare.dest.y, label: 'Drop the fare' };
        M.banner = 'Fare aboard — drive to the marker';
      } else if (fare && fare.picked && near(fare.dest, 80) && p.inCar) {
        S.player.money += TUNE.taxiFare;
        M.step++;
        if (M.step >= 2) completeMission(S);
        else { M.fares = []; spawnFare(S); }
      }
      break;
    }
    case 3:
      if (M.step === 0 && p.wanted >= 3) { M.step = 1; M.banner = 'Now lose them!'; }
      else if (M.step === 1 && p.wanted === 0) completeMission(S);
      break;
    case 4: {
      const next = M.crates.find((c) => !c.taken);
      if (next) {
        M.marker = next;
        if (near(next, 55) && !p.inCar) { next.taken = true; S.audio.pickup(); S.player.money += 25; }
      } else {
        M.marker = safehouseMarker(S);
        if (near(M.marker, 90)) completeMission(S);
      }
      break;
    }
    case 5:
      if (M.step === 0 && near(M.marker, 80)) {
        M.step = 1; addWanted(S, 4); S.player.money += 300;
        M.banner = 'Vault cracked! Lose 4 stars!';
        M.marker = null;
      } else if (M.step === 1 && p.wanted === 0) completeMission(S);
      break;
  }
}

function safehouseMarker(S) {
  const s = shopByKind(S.world, 'safehouse');
  return { x: s.x, y: s.y, label: 'Safehouse' };
}

export function missionObjective(S) {
  const M = S.missions;
  if (M.won) return 'King of Solmar Bay!';
  if (!M.active) return 'Press Enter to start: ' + BRIEFINGS[M.index].title;
  const steps = [
    ['Steal a car', 'Drive to the Garage'],
    ['Deliver package ' + (M.step + 1) + '/3', 'Deliver package ' + (M.step + 1) + '/3'],
    ['Pick up the fare', 'Drop the fare'],
    ['Get 3 stars', 'Lose the cops'],
    ['Collect crates', 'Return to the Safehouse'],
    ['Crack the bank vault', 'Escape 4 stars'],
  ];
  const t = M.timer > 0 ? ' — ' + Math.ceil(M.timer) + 's' : '';
  return BRIEFINGS[M.index].title + ': ' + steps[M.index][Math.min(M.step, 1)] + t;
}
