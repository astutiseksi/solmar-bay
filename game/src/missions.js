// The story: Milo Reyes, fresh out of the Solmar Bay marina jail, works
// for fixer Lena Cruz to pay off a debt — and ends up pulling the biggest
// score the city has ever seen. Six missions, played in order, each a
// small state machine of steps (go to, pick up, deliver, collect, escape).
import { makePed } from './pedestrians.js';

function shop(G, type) {
  return G.city.shops.find((s) => s.type === type);
}

export const MISSIONS = [
  {
    id: 'fresh-wheels', title: 'Fresh Wheels', giver: 'Lena Cruz',
    briefing: 'Lena: "Out already? Good. I need wheels — any wheels. Jack a car and bring it to my garage. Don\'t scratch it... much."',
    reward: 150,
    steps: [
      { type: 'steal', text: 'Steal a car (walk up and press E)' },
      { type: 'goto', at: (G) => shop(G, 'garage'), text: 'Drive the car to Lena\'s Garage' },
    ],
  },
  {
    id: 'package-run', title: 'Package Run', giver: 'Lena Cruz',
    briefing: 'Lena: "Three packages, three drop-offs, and the clock is ticking. The buyers don\'t like waiting — and neither do I."',
    reward: 300, timer: 170,
    steps: [
      { type: 'goto', at: (G) => ({ x: 1020, y: 1460 }), text: 'Pick up the packages at the Old Town corner' },
      { type: 'goto', at: (G) => ({ x: 3420, y: 920 }), text: 'Deliver to the Hills overlook' },
      { type: 'goto', at: (G) => ({ x: 4620, y: 2540 }), text: 'Deliver to Palm Beach' },
      { type: 'goto', at: (G) => ({ x: 1620, y: 3080 }), text: 'Deliver to the Marina market' },
    ],
  },
  {
    id: 'night-cab', title: 'Night Cab', giver: 'Benny the Dispatcher',
    briefing: 'Benny: "Two fares waiting, driver. Pick them up, drop them off, keep the meter running. Tips are yours."',
    reward: 250,
    steps: [
      { type: 'fare', at: (G) => ({ x: 2220, y: 1460 }), dest: (G) => ({ x: 4020, y: 920 }), text: 'Pick up the fare at Downtown, drop them at the Hills' },
      { type: 'fare', at: (G) => ({ x: 2820, y: 2000 }), dest: (G) => ({ x: 4620, y: 2000 }), text: 'Pick up the fare at the Marina, drop them at Palm Beach' },
    ],
  },
  {
    id: 'hot-pursuit', title: 'Hot Pursuit', giver: 'Lena Cruz',
    briefing: 'Lena: "The cops know your face now. Lose them — three stars and counting — then lay low at the safehouse."',
    reward: 400,
    steps: [
      { type: 'wanted', stars: 3, text: 'Get the cops\' attention — wanted level 3' },
      { type: 'escape', at: (G) => shop(G, 'safehouse'), text: 'Escape the police and reach the Bayview Safehouse' },
    ],
  },
  {
    id: 'harbor-job', title: 'The Harbor Job', giver: 'Dante "The Crane"',
    briefing: 'Dante: "Four crates on the docks, fresh off a freighter. Grab them all. The harbor crew is... uncooperative."',
    reward: 600,
    steps: [
      { type: 'collect', count: 4, at: (G) => shop(G, 'docks'), radius: 320, text: 'Collect 4 crates at the Harbor Docks' },
      { type: 'goto', at: (G) => shop(G, 'garage'), text: 'Bring the crates back to Lena\'s Garage' },
    ],
  },
  {
    id: 'the-big-score', title: 'The Big Score', giver: 'Lena Cruz',
    briefing: 'Lena: "Solmar Bank. One vault, one crew, one shot. Grab the cash, outrun the whole department, and we\'re free."',
    reward: 1500,
    steps: [
      { type: 'goto', at: (G) => shop(G, 'bank'), text: 'Get to Solmar Bank' },
      { type: 'hold', seconds: 6, text: 'Crack the vault — hold position!' },
      { type: 'wanted', stars: 4, text: 'The alarm is up — wanted level 4!' },
      { type: 'escape', at: (G) => shop(G, 'safehouse'), text: 'Escape to the Bayview Safehouse with the cash' },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return;
  G.mission = {
    index, def, step: 0, timer: def.timer || 0,
    hold: 0, collected: 0, crates: [],
    farePed: null, fareState: 'pickup',
    dialog: def.briefing, dialogTimer: 7,
    state: 'active',
  };
  if (def.id === 'harbor-job') {
    const docks = shop(G, 'docks');
    for (let i = 0; i < 4; i += 1) {
      G.mission.crates.push({
        x: docks.x + G.rng.range(-220, 220),
        y: docks.y + G.rng.range(-160, 160),
        taken: false,
      });
    }
  }
  if (def.id === 'night-cab') spawnFare(G);
  G.banner(`Mission: ${def.title}`, '#ffd94d');
  G.audio.mission();
}

function spawnFare(G) {
  const step = currentStep(G);
  if (!step) return;
  const at = step.at(G);
  const ped = makePed(G.rng, at.x + 30, at.y + 30);
  ped.state = 'fare';
  ped.shirt = '#f2c94c';
  G.peds.push(ped);
  G.mission.farePed = ped;
  G.mission.fareState = 'pickup';
}

export function currentStep(G) {
  if (!G.mission || G.mission.state !== 'active') return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function missionTarget(G) {
  const step = currentStep(G);
  if (!step) return null;
  if (step.type === 'collect') {
    const left = G.mission.crates.find((c) => !c.taken);
    return left ? { x: left.x, y: left.y, label: `Crates ${G.mission.collected}/${step.count}` } : null;
  }
  if (step.type === 'fare') {
    const pos = G.mission.fareState === 'pickup' ? step.at(G) : step.dest(G);
    return { x: pos.x, y: pos.y, label: G.mission.fareState === 'pickup' ? 'Pick up the fare' : 'Drop off the fare' };
  }
  if (step.type === 'steal' || step.type === 'wanted') return null;
  if (step.type === 'hold') return { x: G.player.x, y: G.player.y, label: 'Hold position!' };
  const at = step.at(G);
  return at ? { x: at.x, y: at.y, label: step.text } : null;
}

function advance(G) {
  G.mission.step += 1;
  G.mission.hold = 0;
  G.audio.pickup();
  if (G.mission.step >= G.mission.def.steps.length) completeMission(G);
  else if (currentStep(G)?.type === 'fare') spawnFare(G);
}

function completeMission(G) {
  const def = G.mission.def;
  G.money += def.reward;
  G.stats.missions += 1;
  G.stats.earned += def.reward;
  G.mission.state = 'done';
  G.banner(`Mission complete: ${def.title}  +$${def.reward}`, '#7ee081');
  G.audio.cash();
  G.saveGame();
  if (G.mission.index + 1 < MISSIONS.length) {
    setTimeout(() => { if (G.screen === 'play') startMission(G, G.mission.index + 1); }, 2500);
  } else {
    G.screen = 'won';
    G.audio.mission();
  }
}

function failMission(G, reason) {
  G.mission.state = 'failed';
  G.banner(`Mission failed: ${reason}`, '#ff5a4d');
  G.audio.fail();
  setTimeout(() => { if (G.screen === 'play') startMission(G, G.mission.index); }, 2500);
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || m.state !== 'active') return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Out of time'); return; }
  }
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;
  const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
  if (step.type === 'steal') {
    if (p.car) advance(G);
  } else if (step.type === 'goto') {
    const at = step.at(G);
    if (near(at.x, at.y, 70)) advance(G);
  } else if (step.type === 'wanted') {
    if (G.wanted >= step.stars) advance(G);
    else if (m.def.id === 'the-big-score') { /* alarm raises it in hold step */ }
  } else if (step.type === 'escape') {
    const at = step.at(G);
    if (near(at.x, at.y, 80) && G.wanted === 0) advance(G);
    else if (near(at.x, at.y, 80) && G.wanted > 0) {
      m.dialog = 'Lay low nearby until the heat dies down, then slip inside.';
      m.dialogTimer = 3;
    }
  } else if (step.type === 'hold') {
    const bank = shop(G, 'bank');
    if (near(bank.x, bank.y, 90)) {
      m.hold += dt;
      if (m.hold >= step.seconds) {
        G.money += 200;
        G.wanted = Math.max(G.wanted, 4);
        G.banner('Vault open! The alarm is screaming — RUN!', '#ff5a4d');
        G.audio.fail();
        advance(G);
      }
    } else m.hold = Math.max(0, m.hold - dt * 2);
  } else if (step.type === 'collect') {
    for (const c of m.crates) {
      if (!c.taken && near(c.x, c.y, 46)) {
        c.taken = true;
        m.collected += 1;
        G.audio.pickup();
        G.addParticles(c.x, c.y, 8, '#ffd94d');
        if (G.wanted < 2 && m.collected === 2) G.commitCrime(1, 'stealing crates');
        if (m.collected >= step.count) advance(G);
        break;
      }
    }
  } else if (step.type === 'fare') {
    const fare = m.farePed;
    if (m.fareState === 'pickup') {
      const at = step.at(G);
      if (fare && fare.state !== 'dead' && near(at.x, at.y, 60) && p.car) {
        m.fareState = 'dropoff';
        fare.state = 'dead'; // riding with the player now
        G.banner('Fare aboard — drive to the destination', '#7ee081');
        G.audio.pickup();
      } else if (fare && near(at.x, at.y, 60) && !p.car) {
        m.dialog = 'The fare wants a ride — bring a car!';
        m.dialogTimer = 2;
      }
    } else {
      const dest = step.dest(G);
      if (near(dest.x, dest.y, 70)) {
        G.money += 40;
        G.banner('Fare paid +$40', '#7ee081');
        advance(G);
      }
    }
  }
}
