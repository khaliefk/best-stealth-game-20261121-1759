// The game's rules and state, with no drawing and no browser in it: the player,
// the guards and their vision cones, the sweeping cameras, noise, relics and the
// exit. step() advances one fixed step and pushes what happened onto state.events,
// so the caller can play sounds without the world knowing about audio or screens.
import {
  CAMERA,
  COIN_NOISE_RADIUS,
  COIN_THROW_RANGE,
  COINS_PER_LEVEL,
  COLS,
  FIELD,
  GHOST_BONUS,
  GUARD,
  LEVEL_TIME_BONUS_PER_SECOND,
  LIVES,
  PAR_TIME,
  PLAYER,
  RELIC_POINTS,
  ROWS,
  TILE,
} from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_RELIC = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL_CLEAR = 4;
export const EVENT_GAME_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_SPOTTED = 32;
export const EVENT_COIN_LAND = 64;

const GUARD_PATROL = 'patrol';
const GUARD_SUSPICIOUS = 'suspicious';
const GUARD_CHASE = 'chase';
const GUARD_RETURN = 'return';

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function tileAt(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: null,
    solid: new Uint8Array(COLS * ROWS),
    bush: new Uint8Array(COLS * ROWS),
    player: { x: 0, y: 0, angle: 0, moving: false, running: false, inBush: false },
    guards: [],
    cameras: [],
    relics: [],
    exit: { x: 0, y: 0, open: false },
    lamps: [],
    coinsLeft: COINS_PER_LEVEL,
    thrownCoin: null,
    lives: LIVES,
    score: 0,
    relicsTaken: 0,
    levelTime: 0,
    spottedThisLevel: false,
    lastClear: null,
    pendingThrow: null,
    events: [],
    noiseFlashes: [],
  };

  function solidAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return state.solid[ty * COLS + tx] === 1;
  }

  function bushAt(x, y) {
    const { tx, ty } = tileAt(x, y);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    return state.bush[ty * COLS + tx] === 1;
  }

  /** True when the straight line between two points crosses no solid tile. */
  function lineOfSight(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (solidAt(Math.floor((ax + dx * t) / TILE), Math.floor((ay + dy * t) / TILE))) return false;
    }
    return true;
  }

  /** Circle against the solid tiles: try x, then y, so the body slides along walls. */
  function moveCircle(body, dx, dy, radius) {
    let nx = body.x + dx;
    if (circleHitsSolid(nx, body.y, radius)) nx = body.x;
    let ny = body.y + dy;
    if (circleHitsSolid(nx, ny, radius)) ny = body.y;
    body.x = nx;
    body.y = ny;
  }

  function circleHitsSolid(x, y, radius) {
    const minTx = Math.floor((x - radius) / TILE);
    const maxTx = Math.floor((x + radius) / TILE);
    const minTy = Math.floor((y - radius) / TILE);
    const maxTy = Math.floor((y + radius) / TILE);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!solidAt(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
      }
    }
    return false;
  }

  function loadLevel(index) {
    const def = LEVELS[index];
    state.levelIndex = index;
    state.level = def;
    state.solid.fill(0);
    state.bush.fill(0);
    for (let tx = 0; tx < COLS; tx += 1) {
      state.solid[tx] = 1;
      state.solid[(ROWS - 1) * COLS + tx] = 1;
    }
    for (let ty = 0; ty < ROWS; ty += 1) {
      state.solid[ty * COLS] = 1;
      state.solid[ty * COLS + COLS - 1] = 1;
    }
    for (const [x, y, w, h] of def.walls) {
      for (let ty = y; ty < y + h; ty += 1) {
        for (let tx = x; tx < x + w; tx += 1) state.solid[ty * COLS + tx] = 1;
      }
    }
    for (const [x, y, w, h] of def.crates) {
      for (let ty = y; ty < y + h; ty += 1) {
        for (let tx = x; tx < x + w; tx += 1) state.solid[ty * COLS + tx] = 1;
      }
    }
    for (const [x, y, w, h] of def.bushes) {
      for (let ty = y; ty < y + h; ty += 1) {
        for (let tx = x; tx < x + w; tx += 1) state.bush[ty * COLS + tx] = 1;
      }
    }
    const start = tileCenter(def.player[0], def.player[1]);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.angle = 0;
    state.guards = def.guards.map((g) => {
      const first = tileCenter(g.waypoints[0][0], g.waypoints[0][1]);
      return {
        x: first.x,
        y: first.y,
        angle: 0,
        state: GUARD_PATROL,
        wpIndex: 1 % g.waypoints.length,
        waypoints: g.waypoints.map(([tx, ty]) => tileCenter(tx, ty)),
        pause: 0,
        detection: 0,
        target: { x: first.x, y: first.y },
        stare: 0,
        search: 0,
        lostSight: 0,
        stuck: 0,
        stepAcc: 0,
      };
    });
    state.cameras = def.cameras.map((c) => {
      const at = tileCenter(c.tile[0], c.tile[1]);
      return {
        x: at.x,
        y: at.y,
        angle: c.baseAngle,
        baseAngle: c.baseAngle,
        sweep: c.sweep,
        phase: 0,
        detection: 0,
      };
    });
    state.relics = def.relics.map(([tx, ty]) => {
      const at = tileCenter(tx, ty);
      return { x: at.x, y: at.y, taken: false };
    });
    const exitAt = tileCenter(def.exit[0], def.exit[1]);
    state.exit.x = exitAt.x;
    state.exit.y = exitAt.y;
    state.exit.open = false;
    state.lamps = def.lamps.map(([tx, ty]) => tileCenter(tx, ty));
    state.coinsLeft = COINS_PER_LEVEL;
    state.thrownCoin = null;
    state.relicsTaken = 0;
    state.levelTime = 0;
    state.spottedThisLevel = false;
    state.noiseFlashes = [];
  }

  function resetRun() {
    state.lives = LIVES;
    state.score = 0;
    loadLevel(0);
  }

  function respawnAfterCaught() {
    const start = tileCenter(state.level.player[0], state.level.player[1]);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.angle = 0;
    for (const guard of state.guards) {
      const first = guard.waypoints[0];
      guard.x = first.x;
      guard.y = first.y;
      guard.state = GUARD_PATROL;
      guard.wpIndex = 1 % guard.waypoints.length;
      guard.detection = 0;
      guard.pause = 0;
      guard.stare = 0;
      guard.search = 0;
      guard.lostSight = 0;
    }
    for (const camera of state.cameras) camera.detection = 0;
    state.thrownCoin = null;
  }

  function hearNoise(x, y, radius) {
    state.noiseFlashes.push({ x, y, radius, age: 0 });
    for (const guard of state.guards) {
      if (guard.state === GUARD_CHASE) continue;
      if (Math.hypot(guard.x - x, guard.y - y) <= radius) {
        guard.state = GUARD_SUSPICIOUS;
        guard.target.x = x;
        guard.target.y = y;
        guard.search = GUARD.searchTime;
        guard.stare = 0;
      }
    }
  }

  function throwCoinAt(wx, wy) {
    if (state.coinsLeft <= 0 || state.thrownCoin) return;
    const p = state.player;
    const dx = wx - p.x;
    const dy = wy - p.y;
    const dist = Math.hypot(dx, dy);
    const range = Math.min(dist, COIN_THROW_RANGE);
    let tx = p.x + (dist === 0 ? 0 : (dx / dist) * range);
    let ty = p.y + (dist === 0 ? 0 : (dy / dist) * range);
    tx = Math.max(TILE, Math.min(FIELD.width - TILE, tx));
    ty = Math.max(TILE, Math.min(FIELD.height - TILE, ty));
    // A coin that would land inside a wall slides back toward the player until it is free.
    for (let tries = 0; tries < 12 && circleHitsSolid(tx, ty, 6); tries += 1) {
      tx -= (tx - p.x) * 0.15;
      ty -= (ty - p.y) * 0.15;
    }
    state.coinsLeft -= 1;
    state.thrownCoin = { x: p.x, y: p.y, tx, ty, t: 0, duration: 0.35 };
  }

  /** How well `watcher` at (x, y) facing `angle` can see the player right now: 0 to 1. */
  function visibilityFrom(x, y, angle, range, halfAngle) {
    const p = state.player;
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return 0;
    if (dist > 1 && angleDiff(angle, Math.atan2(dy, dx)) > halfAngle) return 0;
    if (!lineOfSight(x, y, p.x, p.y)) return 0;
    let seen = 1 - dist / (range * 1.6);
    if (p.inBush) seen *= GUARD.bushFactor;
    if (p.running) seen = Math.min(1, seen * 1.35);
    return Math.max(0, seen);
  }

  function stepGuard(guard, dt) {
    const p = state.player;
    const seen = visibilityFrom(guard.x, guard.y, guard.angle, GUARD.sightRange, GUARD.sightHalfAngle);
    if (seen > 0) {
      guard.detection = Math.min(1, guard.detection + GUARD.detectRate * seen * dt);
      guard.target.x = p.x;
      guard.target.y = p.y;
      guard.lostSight = 0;
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.forgetRate * dt);
      guard.lostSight += dt;
    }
    if (guard.detection >= 1 && guard.state !== GUARD_CHASE) {
      guard.state = GUARD_CHASE;
      state.spottedThisLevel = true;
      state.events.push({ type: 'spotted', x: guard.x, y: guard.y });
    }

    let speed = 0;
    let heading = guard.angle;
    if (guard.state === GUARD_PATROL) {
      const wp = guard.waypoints[guard.wpIndex];
      if (guard.pause > 0) {
        guard.pause -= dt;
        heading = Math.atan2(wp.y - guard.y, wp.x - guard.x);
      } else {
        const dx = wp.x - guard.x;
        const dy = wp.y - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 8) {
          guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
          guard.pause = 0.7;
        } else {
          heading = Math.atan2(dy, dx);
          speed = GUARD.patrolSpeed;
        }
      }
    } else if (guard.state === GUARD_SUSPICIOUS) {
      const dx = guard.target.x - guard.x;
      const dy = guard.target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        heading = Math.atan2(dy, dx);
        speed = GUARD.investigateSpeed;
      } else if (guard.search > 0) {
        guard.search -= dt;
        guard.stare += dt;
        heading = guard.angle + Math.sin(guard.stare * 2.2) * 0.9 * dt * 4;
      } else {
        guard.state = GUARD_RETURN;
      }
    } else if (guard.state === GUARD_CHASE) {
      if (seen > 0 || guard.lostSight < 2.5) {
        const dx = guard.target.x - guard.x;
        const dy = guard.target.y - guard.y;
        heading = Math.atan2(dy, dx);
        speed = GUARD.chaseSpeed;
      } else {
        guard.state = GUARD_SUSPICIOUS;
        guard.search = GUARD.searchTime;
      }
    } else if (guard.state === GUARD_RETURN) {
      // Walk back to the nearest waypoint, then resume the patrol.
      let best = guard.waypoints[0];
      let bestDist = Infinity;
      for (const wp of guard.waypoints) {
        const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
        if (d < bestDist) {
          bestDist = d;
          best = wp;
        }
      }
      const dx = best.x - guard.x;
      const dy = best.y - guard.y;
      if (bestDist < 10) {
        guard.state = GUARD_PATROL;
        guard.wpIndex = (guard.waypoints.indexOf(best) + 1) % guard.waypoints.length;
      } else {
        heading = Math.atan2(dy, dx);
        speed = GUARD.patrolSpeed;
      }
    }

    guard.angle = angleLerp(guard.angle, heading, Math.min(1, dt * 8));
    if (speed > 0) {
      const beforeX = guard.x;
      const beforeY = guard.y;
      const nx = Math.cos(guard.angle) * speed * dt;
      const ny = Math.sin(guard.angle) * speed * dt;
      moveCircle(guard, nx, ny, GUARD.radius);
      guard.stepAcc += speed * dt;
      if (guard.stepAcc > 34) {
        guard.stepAcc = 0;
        state.events.push({ type: 'guardStep', x: guard.x, y: guard.y });
      }
      // A guard wedged against a wall skips to the nearest waypoint instead of
      // pushing at it forever: no patrol in this game is allowed to jam.
      const moved = Math.hypot(guard.x - beforeX, guard.y - beforeY);
      if (moved < speed * dt * 0.25) guard.stuck += dt;
      else guard.stuck = 0;
      if (guard.stuck > 1.2) {
        guard.stuck = 0;
        guard.state = GUARD_RETURN;
      }
    } else {
      guard.stuck = 0;
    }
  }

  function stepCamera(camera, dt) {
    camera.phase += dt * CAMERA.sweepSpeed;
    camera.angle = camera.baseAngle + Math.sin(camera.phase) * camera.sweep;
    const seen = visibilityFrom(camera.x, camera.y, camera.angle, CAMERA.sightRange, CAMERA.sightHalfAngle);
    if (seen > 0) {
      camera.detection = Math.min(1, camera.detection + CAMERA.detectRate * seen * dt);
    } else {
      camera.detection = Math.max(0, camera.detection - GUARD.forgetRate * dt);
    }
    if (camera.detection >= 1) {
      camera.detection = 0.4;
      state.spottedThisLevel = true;
      state.events.push({ type: 'spotted', x: camera.x, y: camera.y });
      // The nearest guard runs to the player's position.
      let nearest = null;
      let nearestDist = Infinity;
      for (const guard of state.guards) {
        const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = guard;
        }
      }
      if (nearest) {
        nearest.state = GUARD_CHASE;
        nearest.detection = 1;
        nearest.target.x = state.player.x;
        nearest.target.y = state.player.y;
        nearest.lostSight = 0;
      }
    }
  }

  let playerStepAcc = 0;
  let runNoiseTimer = 0;

  /**
   * One fixed step. `input` carries the move direction (-1..1 on each axis), whether
   * the player is running, and a world-space coin target when the mouse was clicked.
   * Returns an EVENT_* bitmask of what happened this step.
   */
  function step(dt, input) {
    let events = 0;
    state.levelTime += dt;
    const p = state.player;
    p.inBush = bushAt(p.x, p.y);

    if (input.throwCoin) throwCoinAt(input.throwCoin.x, input.throwCoin.y);

    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mag = Math.hypot(input.mx, input.my);
    const nx = mag > 0 ? (input.mx / Math.max(1, mag)) * speed * dt : 0;
    const ny = mag > 0 ? (input.my / Math.max(1, mag)) * speed * dt : 0;
    p.moving = mag > 0;
    p.running = input.run && mag > 0;
    if (p.moving) {
      p.angle = Math.atan2(ny, nx);
      moveCircle(p, nx, ny, PLAYER.radius);
      playerStepAcc += speed * dt;
      if (playerStepAcc > 30) {
        playerStepAcc = 0;
        state.events.push({ type: 'playerStep', x: p.x, y: p.y, loud: p.running });
      }
      if (p.running) {
        runNoiseTimer -= dt;
        if (runNoiseTimer <= 0) {
          runNoiseTimer = 0.25;
          hearNoise(p.x, p.y, PLAYER.noiseRadius);
        }
      }
    }

    if (state.thrownCoin) {
      const coin = state.thrownCoin;
      coin.t += dt / coin.duration;
      if (coin.t >= 1) {
        state.thrownCoin = null;
        state.events.push({ type: 'coinLand', x: coin.tx, y: coin.ty });
        events |= EVENT_COIN_LAND;
        hearNoise(coin.tx, coin.ty, COIN_NOISE_RADIUS);
      }
    }

    for (const guard of state.guards) stepGuard(guard, dt);
    for (const camera of state.cameras) stepCamera(camera, dt);

    for (const relic of state.relics) {
      if (!relic.taken && Math.hypot(relic.x - p.x, relic.y - p.y) < 28) {
        relic.taken = true;
        state.relicsTaken += 1;
        state.score += RELIC_POINTS;
        state.events.push({ type: 'relic', x: relic.x, y: relic.y });
        events |= EVENT_RELIC;
        if (state.relicsTaken === state.relics.length) state.exit.open = true;
      }
    }

    for (const guard of state.guards) {
      if (guard.state === GUARD_CHASE && Math.hypot(guard.x - p.x, guard.y - p.y) < 26) {
        state.lives -= 1;
        state.events.push({ type: 'caught', x: p.x, y: p.y });
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          events |= EVENT_GAME_OVER;
        } else {
          respawnAfterCaught();
        }
        break;
      }
    }

    if (state.exit.open && Math.hypot(state.exit.x - p.x, state.exit.y - p.y) < 30) {
      const timeBonus = Math.max(0, Math.round((PAR_TIME - state.levelTime) * LEVEL_TIME_BONUS_PER_SECOND));
      const ghost = state.spottedThisLevel ? 0 : GHOST_BONUS;
      state.score += timeBonus + ghost;
      state.lastClear = { timeBonus, ghost, clearedName: state.level.name, win: state.levelIndex + 1 >= LEVELS.length };
      state.events.push({ type: 'levelClear', timeBonus, ghost, clearedName: state.level.name, win: state.levelIndex + 1 >= LEVELS.length });
      events |= EVENT_LEVEL_CLEAR;
      if (state.levelIndex + 1 >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        loadLevel(state.levelIndex + 1);
      }
    }

    for (const flash of state.noiseFlashes) flash.age += dt;
    state.noiseFlashes = state.noiseFlashes.filter((f) => f.age < 0.7);
    return events;
  }

  resetRun();
  return { state, step, loadLevel, resetRun };
}
