// config.js — tuning, palette, districts and car models for Solmar Bay.
// One place for every number a designer would tweak.

export const WORLD = { w: 5200, h: 3800, roadGap: 400, roadHalf: 34, beachX: 260 };

export const DISTRICTS = [
  { name: 'Downtown',  x: 1800, y: 300,  w: 1600, h: 1100, tint: '#8a7f8d' },
  { name: 'Old Town',  x: 300,  y: 300,  w: 1300, h: 1100, tint: '#a08b62' },
  { name: 'Palm Beach',x: 260,  y: 1500, w: 1500, h: 1000, tint: '#c9a86a' },
  { name: 'Marina',    x: 260,  y: 2600, w: 1500, h: 1000, tint: '#5f8fa8' },
  { name: 'The Hills', x: 2000, y: 1500, w: 1500, h: 1000, tint: '#6f8f5f' },
  { name: 'Harbor',    x: 3800, y: 1500, w: 1300, h: 2000, tint: '#7d7468' },
];

export const PALETTE = {
  grass: '#4d7a44', grass2: '#557f4a', road: '#33363d', roadLine: '#d8c95a',
  sidewalk: '#8d8578', sand: '#e0c98f', sea: '#1f6f8f', seaDeep: '#155a78',
  building: '#6b5a6e', building2: '#7a6a72', roof: '#54424f', windowLit: '#ffd98a',
  windowDark: '#2c2f38', park: '#3f6b38', tree: '#2f5d2a', palm: '#3a7a34',
  lamp: '#ffe9a8', hud: '#ffffff', danger: '#ff4d4d', gold: '#ffd24d',
};

export const CAR_MODELS = [
  { name: 'Comet',   color: '#d84040', len: 52, wid: 26, accel: 340, top: 430, grip: 3.2, price: 0 },
  { name: 'Bison',   color: '#4d7dd8', len: 58, wid: 28, accel: 280, top: 380, grip: 2.8, price: 0 },
  { name: 'Sunrunner', color: '#e8b73a', len: 50, wid: 24, accel: 360, top: 460, grip: 3.4, price: 0 },
  { name: 'Gullwing', color: '#37b06a', len: 54, wid: 26, accel: 320, top: 420, grip: 3.1, price: 0 },
  { name: 'Cab',     color: '#f2c230', len: 52, wid: 26, accel: 300, top: 400, grip: 3.0, price: 0, taxi: true },
  { name: 'Cruiser', color: '#20242e', len: 56, wid: 27, accel: 330, top: 450, grip: 3.3, price: 0, police: true },
];

export const TUNE = {
  walkSpeed: 170, runSpeed: 300, playerHp: 100, pistolMag: 12, pistolReserve: 60,
  pistolDamage: 34, punchDamage: 18, punchRange: 46, bulletSpeed: 900,
  wantedDecayDelay: 26, bustTime: 1.4, bustFine: 200, deathFine: 150,
  packageReward: 100, missionPayouts: [150, 250, 200, 300, 400, 800],
  taxiFare: 60, hospitalCost: 80, ammoCost: 50, dayLengthMin: 24 * 60,
  startClockMin: 17 * 60 + 12, trafficCars: 22, parkedCars: 14, pedCount: 46,
  hiddenPackages: 15, copCarsMax: 4, footCopsMax: 6,
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'Solmar Bay';
}
