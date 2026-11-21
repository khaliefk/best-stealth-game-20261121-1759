// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot (move toward the nearest
// relic, keep out of every vision cone), so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { FIELD, STEP, TILE } from './config.js';
import { EVENT_LEVEL_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 14;

const DIRS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** True when the straight line between two points crosses no solid tile. */
function clearLine(state, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((ax + dx * t) / TILE);
    const ty = Math.floor((ay + dy * t) / TILE);
    if (tx < 0 || ty < 0 || tx >= 32 || ty >= 18 || state.solid[ty * 32 + tx] === 1) return false;
  }
  return true;
}

/** How exposed the point (x, y) is to the guards: 0 when no cone reaches it. */
function exposure(state, x, y) {
  let worst = 0;
  for (const guard of state.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 250) continue;
    if (dist > 1 && angleDiff(guard.angle, Math.atan2(dy, dx)) > 0.46) continue;
    if (!clearLine(state, guard.x, guard.y, x, y)) continue;
    worst = Math.max(worst, 1 - dist / 400);
    if (dist < 70) worst = Math.max(worst, 1.5);
  }
  for (const camera of state.cameras) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 230) continue;
    if (dist > 1 && angleDiff(camera.angle, Math.atan2(dy, dx)) > 0.42) continue;
    if (!clearLine(state, camera.x, camera.y, x, y)) continue;
    worst = Math.max(worst, 1 - dist / 400);
  }
  return worst;
}

/** The autopilot: of the nine ways to move, the one closest to the target that no cone sees. */
function autopilot(state) {
  const p = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const relic of state.relics) {
    if (relic.taken) continue;
    const d = Math.hypot(relic.x - p.x, relic.y - p.y);
    if (d < targetDist) {
      targetDist = d;
      target = relic;
    }
  }
  if (!target) target = state.exit;
  let best = DIRS[0];
  let bestScore = Infinity;
  for (const [dx, dy] of DIRS) {
    const x = p.x + dx * 30;
    const y = p.y + dy * 30;
    if (x < TILE || y < TILE || x > FIELD.width - TILE || y > FIELD.height - TILE) continue;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (state.solid[ty * 32 + tx] === 1) continue;
    // A step is priced by how far it leaves the player from the target, how exposed
    // the step and the step after it are to any cone, and how close any guard is:
    // the pilot would rather wait than walk into a patrol's path.
    let score = Math.hypot(target.x - x, target.y - y);
    score += exposure(state, x, y) * 1500;
    score += exposure(state, x + dx * 30, y + dy * 30) * 750;
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - x, guard.y - y);
      if (d < 140) score += (140 - d) * 8;
    }
    if (score < bestScore) {
      bestScore = score;
      best = [dx, dy];
    }
  }
  return { mx: best[0], my: best[1], run: false, throwCoin: null };
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is start)
 * and return the screen to draw over it, the best score to show and the panel info.
 */
export function stageShot(name, world) {
  const { state } = world;
  world.resetRun();
  if (name === 'win') {
    world.loadLevel(2);
    for (const relic of state.relics) relic.taken = true;
    state.relicsTaken = state.relics.length;
    state.exit.open = true;
    state.score = 1250;
    state.player.x = state.exit.x - 60;
    state.player.y = state.exit.y;
    return { screen: SCREEN_WIN, best: 1250, info: null };
  }
  if (name === 'alert') {
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, run: false, throwCoin: null });
    const guard = state.guards[0];
    // Put the player just inside the guard's cone, far enough that the guard cannot
    // reach him in the few frames the scene runs: the frame catches the guard
    // suspicious, his cone orange, his detection ring nearly full.
    state.player.x = guard.x + Math.cos(guard.angle) * 120;
    state.player.y = guard.y + Math.sin(guard.angle) * 120;
    guard.detection = 0.7;
    guard.state = 'suspicious';
    guard.target.x = state.player.x;
    guard.target.y = state.player.y;
    guard.search = 3;
    for (let i = 0; i < 0.25 / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, run: false, throwCoin: null });
    }
    return { screen: SCREEN_PLAY, best: 0, info: null };
  }
  if (name === 'play') {
    // A caught player respawns and the pilot keeps sneaking: the scene runs the full
    // time either way, so the frame is a game in progress, not a respawn.
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state));
      if (events & (EVENT_LEVEL_CLEAR | EVENT_WIN)) break;
    }
    return { screen: state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: state.score, info: null };
  }
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, { mx: 0, my: 0, run: false, throwCoin: null });
  }
  return { screen: SCREEN_TITLE, best: 0, info: null };
}
