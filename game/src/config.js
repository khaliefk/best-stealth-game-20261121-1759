// Lantern Heist: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** Tile size in pixels. Levels are 32 by 18 tiles. */
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 290,
  /** How far a running footstep is heard, in pixels. Walking is silent. */
  noiseRadius: 190,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 185,
  investigateSpeed: 130,
  /** How far a guard can see, in pixels. */
  sightRange: 250,
  /** Half-angle of the vision cone, in radians. */
  sightHalfAngle: 0.46,
  /** Detection fills per second when the player is fully in view. */
  detectRate: 1.15,
  /** Detection drains per second when the player is out of view. */
  forgetRate: 0.35,
  /** A player standing in a bush is this much harder to spot. */
  bushFactor: 0.22,
  /** Seconds a guard stares at the last seen spot before giving up. */
  stareTime: 1.4,
  /** Seconds a guard searches around a noise point before returning. */
  searchTime: 3.0,
};

export const CAMERA = {
  radius: 10,
  sightRange: 230,
  sightHalfAngle: 0.42,
  /** Radians per second the camera sweeps. */
  sweepSpeed: 0.55,
  detectRate: 1.5,
};

export const LIVES = 3;
export const COINS_PER_LEVEL = 3;
/** How far a thrown coin's clink carries, in pixels. */
export const COIN_NOISE_RADIUS = 260;
/** How far a coin flies from the player, in pixels. */
export const COIN_THROW_RANGE = 320;

export const RELIC_POINTS = 100;
export const GHOST_BONUS = 150;
export const LEVEL_TIME_BONUS_PER_SECOND = 2;

/** Seconds of play that count as a par time for the time bonus. */
export const PAR_TIME = 75;

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#20242e',
  floorB: '#1c2029',
  floorLine: '#262b38',
  wall: '#3a4152',
  wallTop: '#4d566e',
  crate: '#6b4f2a',
  crateTop: '#8a6a3a',
  crateEdge: '#4a3419',
  bush: '#1d3a24',
  bushLeaf: '#2c5a35',
  bushDeep: '#142a1a',
  lampGlow: '#f7c948',
  relic: '#ffd94d',
  relicGlow: '#ffedb0',
  exit: '#39d98a',
  exitLocked: '#5a6b62',
  player: '#7b5cff',
  playerCloak: '#4a3496',
  guard: '#e8e4d8',
  guardUniform: '#c94f42',
  coneCalm: 'rgba(247, 201, 72, 0.20)',
  coneCalmEdge: 'rgba(247, 201, 72, 0.55)',
  coneSuspicious: 'rgba(255, 149, 0, 0.30)',
  coneSuspiciousEdge: 'rgba(255, 149, 0, 0.75)',
  coneAlert: 'rgba(255, 59, 48, 0.34)',
  coneAlertEdge: 'rgba(255, 59, 48, 0.9)',
  panel: '#171a21',
  panelEdge: '#2e3442',
  text: '#f2efe6',
  muted: '#9aa1b0',
  gold: '#f7c948',
  danger: '#ff5a4e',
  ok: '#39d98a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lantern-heist.best';
