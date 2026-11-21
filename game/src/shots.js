// Lantern Heist: the staged scenes behind ?shot=start|play|alarm|win. Each one plays the real
// rules forward from a fresh world — a scripted route for the play scene, a walk into a guard's
// cone for the alarm scene — so the frame is what the game really looks like, and the same
// seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Steer the thief toward a pixel target for one step, sneaking when asked. */
function steer(world, tx, ty, sneak) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Follow a list of tile waypoints for up to `seconds`, then stop. */
function walkRoute(world, tiles, seconds, sneakFrom) {
  let elapsed = 0;
  let wp = 0;
  while (elapsed < seconds) {
    const target = tiles[Math.min(wp, tiles.length - 1)];
    const tx = target[0] * TILE + 16;
    const ty = target[1] * TILE + 16;
    const p = world.state.player;
    if (Math.hypot(tx - p.x, ty - p.y) < 14 && wp < tiles.length - 1) wp += 1;
    const dir = steer(world, tx, ty, false);
    world.step(STEP, dir, elapsed >= sneakFrom, null);
    elapsed += STEP;
    if (world.state.over || world.state.won) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score.
 * Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Around the crate, down the gap into the great hall, across it, then sneak toward the
    // far crates while a guard's cone sweeps past: the frame shows cones, cover, a lantern
    // and the thief mid-sneak.
    walkRoute(world, [[2, 3], [2, 5], [4, 6], [4, 7], [10, 8], [16, 10], [24, 12]], 14, 10);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alarm') {
    // Stand ahead of the first guard, off to one side of its cone, until it spots the thief,
    // then slip away up the hall: the frame catches the alarm banner and the red cone.
    const guard = world.state.guards[0];
    world.state.player.x = guard.x + 140;
    world.state.player.y = guard.y - 40;
    let elapsed = 0;
    while (elapsed < 6 && !world.state.alarm) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
      elapsed += STEP;
    }
    // A few more steps so the chase is visibly under way, without getting caught.
    for (let i = 0; i < 25; i += 1) world.step(STEP, { x: 0.3, y: -1 }, false, null);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    // The victory screen over the last floor, with a finished run's numbers.
    world.loadFloor(2);
    for (const relic of world.state.floor.relics) relic.taken = true;
    world.state.relicsTaken = world.state.floor.relics.length;
    world.state.score = 12480;
    world.state.totalTime = 512;
    world.state.won = true;
    world.state.message = '';
    world.state.messageTimer = 0;
    return { screen: SCREEN_WIN, best: 12480 };
  }
  // Title: let the guards patrol for a few seconds behind the title card.
  let elapsed = 0;
  while (elapsed < 5) {
    world.step(STEP, { x: 0, y: 0 }, false, null);
    elapsed += STEP;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
