// Solmar Bay — every tuning number, colour and place name in one place.
// The city is an original sun-soaked coastal town: Downtown, Palm Beach,
// Old Town, the Harbor and the Hills. Nothing here is copied from any
// commercial game: all names, characters, vehicles and story are invented.
export const WORLD = { width: 5200, height: 3800 };

/** Vertical roads (x) and horizontal roads (y) that form the street grid. */
export const ROADS_X = [420, 1020, 1620, 2220, 2820, 3420, 4020, 4620];
export const ROADS_Y = [380, 920, 1460, 2000, 2540, 3080];
export const ROAD_W = 96;
export const LANE = 24;

/** Sea on the east edge, beach sand beside it; harbour water south-west. */
export const SEA = { x0: 4900, y0: 0, x1: 5200, y1: 3800 };
export const BEACH = { x0: 4740, x1: 4900 };
export const HARBOUR = { x0: 0, y0: 3440, x1: 1500, y1: 3800 };

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.38,
};

export const PISTOL = { damage: 34, range: 460, cooldown: 0.22, magSize: 12, reload: 1.1 };

export const CAR = {
  length: 62,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turn: 2.6,
  grip: 6.5,
  health: 100,
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 46;
export const COLLECTIBLE_COUNT = 15;

/** Wanted: stars, how many cops each star spawns, cop speed and aggression. */
export const WANTED = [
  { stars: 0, cops: 0, footCops: 0 },
  { stars: 1, cops: 1, footCops: 1 },
  { stars: 2, cops: 2, footCops: 2 },
  { stars: 3, cops: 3, footCops: 3 },
  { stars: 4, cops: 4, footCops: 4 },
  { stars: 5, cops: 6, footCops: 5 },
];
export const WANTED_DECAY_SECONDS = 26;
export const BUST_RADIUS = 34;
export const BUST_SECONDS = 1.4;

export const DAY_LENGTH_SECONDS = 480; // one full in-game day
export const START_HOUR = 17.2; // golden hour, long shadows over the bay

export const PALETTE = {
  grass: '#5d9b4a',
  grassDry: '#7fae56',
  park: '#4c8a3e',
  road: '#3a3d46',
  roadEdge: '#2c2e36',
  sidewalk: '#9a938a',
  lane: '#e8d44d',
  building: ['#c96f4a', '#d9a05b', '#7d9bb5', '#b56b7a', '#8a7fb5', '#5f9a8a', '#c2b280', '#a85f5f'],
  roof: ['#8a4a3a', '#6b5a4a', '#4a5a6b', '#7a5a6b', '#5a6b4a'],
  sea: '#1f7fa8',
  seaDeep: '#16607f',
  sand: '#e8d29a',
  beachUmbrella: ['#e5534b', '#f2c94c', '#4fc3f7', '#ff8a65'],
  tree: '#2f7a33',
  palm: '#3d8a3f',
  text: '#f5f1e8',
  muted: '#cfc8b8',
  hud: '#10131a',
  star: '#ffd94d',
  money: '#7ee081',
  danger: '#ff5a4d',
  mission: '#ffd94d',
  cop: '#2b4a8f',
  copLight: '#ff3b30',
};

export const DISTRICTS = [
  { name: 'Downtown', x0: 0, y0: 0, x1: 2300, y1: 1600 },
  { name: 'Old Town', x0: 0, y0: 1600, x1: 2300, y1: 3440 },
  { name: 'Palm Beach', x0: 4020, y0: 0, x1: 4740, y1: 3800 },
  { name: 'Marina', x0: 2300, y0: 2000, x1: 4740, y1: 3440 },
  { name: 'The Hills', x0: 2300, y0: 0, x1: 4020, y1: 2000 },
  { name: 'Harbor', x0: 0, y0: 3080, x1: 1500, y1: 3440 },
];

export const CAR_MODELS = [
  { name: 'Comet', color: '#d94f3d', speed: 1.12, price: 0 },
  { name: 'Bison', color: '#4a6b8a', speed: 0.92, price: 0 },
  { name: 'Sunrunner', color: '#e8b93c', speed: 1.0, price: 0 },
  { name: 'Gullwing', color: '#7a4a9a', speed: 1.18, price: 0 },
  { name: 'Pickup', color: '#5a7a4a', speed: 0.95, price: 0 },
  { name: 'Sedan', color: '#c8c8c8', speed: 1.0, price: 0 },
  { name: 'Taxi', color: '#f2c94c', speed: 1.0, price: 0 },
  { name: 'Van', color: '#8a8a8a', speed: 0.85, price: 0 },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';
