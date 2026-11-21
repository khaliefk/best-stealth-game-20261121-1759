// Lantern Heist: every number the game tunes on, in one place. Tile size, movement speeds,
// vision and detection rates, lives and coins. Change a value here and the whole game follows.
export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const VIEW_WIDTH = COLS * TILE;
export const VIEW_HEIGHT = ROWS * TILE;
export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 150,
  sneakSpeed: 82,
  radius: 11,
};

export const GUARD = {
  radius: 12,
  // Patrol, chase and search speeds grow floor by floor (index 0, 1, 2).
  patrolSpeed: [68, 84, 100],
  chaseSpeed: [128, 144, 160],
  searchSpeed: [95, 105, 115],
  // How long a guard waits at each patrol waypoint, in seconds.
  waitAtWaypoint: [1.6, 1.2, 0.9],
  // How long a guard searches the last place it saw the thief.
  searchTime: 3.5,
  // How long without a sighting before the alarm dies down.
  alarmCalmTime: 4,
};

export const VISION = {
  range: 196,
  // Half of the cone's angle, in radians: the full cone is about 70 degrees wide.
  halfAngle: 0.61,
  // Suspicion fills 0..1. The base fill rate at point-blank range, per second.
  fillBase: 1.15,
  // Filling slows with distance: at full range it is this fraction of the base rate.
  fillFar: 0.35,
  // Standing in a lantern's light fills suspicion faster; deep shadow fills it slower.
  fillInLight: 1.6,
  fillInShadow: 0.7,
  // Sneaking halves the fill rate; a bush hides the thief unless a guard is very close.
  fillSneaking: 0.5,
  bushRevealRange: 52,
  // Suspicion drains this fast per second while the thief is unseen.
  drain: 0.45,
  // A running thief is heard this far away; a sneaking one is not heard at all.
  noiseRadius: 112,
};

export const GAME = {
  lives: 3,
  coinsPerFloor: 3,
  // How far a thrown coin flies and how far its ping carries.
  coinThrow: 150,
  coinPingRadius: 230,
  // How long guards stay curious about a coin ping, in seconds.
  coinCuriousTime: 4,
  relicScore: 1000,
  floorClearScore: 500,
  ghostBonus: 500,
  // One point per second left under the floor's par time.
  parTime: [150, 180, 210],
  bestKey: 'lantern-heist-best',
};

// The palette. Floors are dark wood and stone; light is warm amber, danger is red, safety is green.
export const COLORS = {
  floorA: '#3d2f21',
  floorB: '#453626',
  floorDark: '#2e2115',
  wall: '#5d5344',
  wallTop: '#7d7260',
  wallDark: '#3d3226',
  crate: '#7a5230',
  crateEdge: '#54371d',
  table: '#5d3f24',
  bush: '#1f4d2a',
  bushLight: '#2f6b3a',
  lanternGlow: 'rgba(255, 190, 90, 0.20)',
  lanternCore: '#ffd27a',
  relic: '#ffd94a',
  relicGlow: 'rgba(255, 217, 74, 0.30)',
  exitLocked: '#c0392b',
  exitOpen: '#2ecc71',
  player: '#e8c96a',
  playerCloak: '#3d2b52',
  guard: '#3a5a8c',
  guardHelmet: '#9aa7b8',
  coneCalm: 'rgba(255, 214, 90, 0.30)',
  coneSuspicious: 'rgba(255, 150, 40, 0.40)',
  coneAlarm: 'rgba(255, 60, 50, 0.48)',
  shadow: 'rgba(6, 8, 16, 0.32)',
  hud: 'rgba(10, 10, 14, 0.78)',
  text: '#f2e8d5',
  textDim: '#b8a888',
};
