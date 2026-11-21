// Lantern Heist: the world. One step advances the thief, every guard, the detection meters,
// the coins and the floor's win/lose state. Guards live in five modes: patrol (walking their
// waypoints, pausing and scanning at each), chase (running at the last place they saw the
// thief, while the alarm is up), search (looking around that spot once the alarm dies down),
// curious (walking to a coin ping) and return (walking back to their patrol). The thief wins a
// floor by taking every relic and reaching the exit; a guard that touches the thief during an
// alarm costs a life.
import { COLS, GAME, GUARD, PLAYER, ROWS, STEP, TILE, VISION } from './config.js';
import { FLOORS, isSolid } from './levels.js';
import { inBush, inLanternLight, inVisionCone } from './vision.js';
import { playAlarm, playCaught, playClear, playCoin, playPickup, playStep } from './audio.js';

export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;

function tileAt(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

/** True when a circle of radius r at (x, y) overlaps a solid tile. */
function hitsSolid(floor, x, y, r) {
  const { tx, ty } = tileAt(x, y);
  for (let gy = ty - 1; gy <= ty + 1; gy += 1) {
    for (let gx = tx - 1; gx <= tx + 1; gx += 1) {
      if (!isSolid(floor, gx, gy)) continue;
      const nearestX = Math.max(gx * TILE, Math.min(x, gx * TILE + TILE));
      const nearestY = Math.max(gy * TILE, Math.min(y, gy * TILE + TILE));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Move a circle one axis at a time so it slides along walls instead of sticking to them.
 * The test radius is 2px smaller than the drawn one: without that slack a circle that ends
 * up a fraction of a pixel inside a wall's edge plane wedges against the corner and can no
 * longer slide past it, as a thief hugging a crate would find, and a one-tile gap stays
 * passable even when the thief enters it a little off centre. */
function moveCircle(floor, body, dx, dy) {
  const r = body.radius - 2;
  const nx = body.x + dx;
  if (!hitsSolid(floor, nx, body.y, r)) body.x = nx;
  const ny = body.y + dy;
  if (!hitsSolid(floor, body.x, ny, r)) body.y = ny;
}

function makeGuard(def, floorIndex) {
  return {
    x: def.spawn.x,
    y: def.spawn.y,
    radius: GUARD.radius,
    facing: 0,
    mode: 'patrol',
    waypoint: 0,
    wait: 0,
    suspicion: 0,
    searchLeft: 0,
    curiousLeft: 0,
    target: { x: def.spawn.x, y: def.spawn.y },
    speed: GUARD.patrolSpeed[floorIndex],
    stepTimer: Math.random() * 0.4,
    scanPhase: Math.random() * Math.PI * 2,
  };
}

export function createWorld() {
  const state = {
    floorIndex: 0,
    floor: null,
    player: null,
    guards: [],
    coins: [],
    thrown: [],
    lives: GAME.lives,
    score: 0,
    relicsTaken: 0,
    alarm: false,
    alarmTimer: 0,
    alarmedThisFloor: false,
    floorTime: 0,
    totalTime: 0,
    muted: false,
    over: false,
    won: false,
    message: '',
    messageTimer: 0,
  };

  function loadFloor(index) {
    const def = FLOORS[index];
    // Fresh copies: relics come back untaken on a new floor, never shared between floors.
    const floor = {
      ...def,
      relics: def.relics.map((r) => ({ ...r, taken: false })),
    };
    state.floorIndex = index;
    state.floor = floor;
    state.player = {
      x: floor.playerStart.x,
      y: floor.playerStart.y,
      radius: PLAYER.radius,
      facing: Math.PI / 2,
      moving: false,
      sneaking: false,
      stepTimer: 0,
    };
    state.guards = def.guards.map((g) => makeGuard(g, index));
    state.coins = [];
    state.thrown = [];
    state.relicsTaken = 0;
    state.alarm = false;
    state.alarmTimer = 0;
    state.alarmedThisFloor = false;
    state.floorTime = 0;
  }

  function startAlarm(guard) {
    if (state.alarm) return EVENT_ALARM;
    state.alarm = true;
    state.alarmedThisFloor = true;
    state.alarmTimer = GUARD.alarmCalmTime;
    for (const g of state.guards) {
      g.mode = 'chase';
      g.target = { x: state.player.x, y: state.player.y };
    }
    state.message = 'SPOTTED! Break line of sight!';
    state.messageTimer = 2.5;
    playAlarm();
    return EVENT_ALARM;
  }

  function catchPlayer() {
    state.lives -= 1;
    playCaught();
    if (state.lives <= 0) {
      state.over = true;
      state.message = 'Caught for the last time.';
      return EVENT_OVER;
    }
    loadFloor(state.floorIndex);
    state.message = 'Caught! A life lost — the floor resets.';
    state.messageTimer = 2.5;
    return EVENT_CAUGHT;
  }

  function clearFloor() {
    let bonus = GAME.floorClearScore;
    if (!state.alarmedThisFloor) bonus += GAME.ghostBonus;
    bonus += Math.max(0, Math.round(GAME.parTime[state.floorIndex] - state.floorTime)) * 10;
    state.score += bonus;
    playClear();
    if (state.floorIndex + 1 >= FLOORS.length) {
      state.won = true;
      state.message = 'Every relic stolen. The heist is done.';
      return EVENT_WIN;
    }
    loadFloor(state.floorIndex + 1);
    state.message = `${FLOORS[state.floorIndex].name} — ${FLOORS[state.floorIndex].hint}`;
    state.messageTimer = 3.5;
    return EVENT_CLEAR;
  }

  function stepGuard(guard, dt) {
    const floor = state.floor;
    const speed = guard.mode === 'chase'
      ? GUARD.chaseSpeed[state.floorIndex]
      : guard.mode === 'search' || guard.mode === 'curious'
        ? GUARD.searchSpeed[state.floorIndex]
        : GUARD.patrolSpeed[state.floorIndex];
    let dest = null;
    if (guard.mode === 'patrol') {
      const def = FLOORS[state.floorIndex].guards[state.guards.indexOf(guard)];
      const wp = def.waypoints[guard.waypoint];
      dest = wp;
      const dist = Math.hypot(wp.x - guard.x, wp.y - guard.y);
      if (dist < 6) {
        if (guard.wait <= 0) guard.wait = GUARD.waitAtWaypoint[state.floorIndex];
        guard.wait -= dt;
        // Scan the room while waiting: sweep the facing back and forth.
        guard.scanPhase += dt * 1.4;
        guard.facing += Math.sin(guard.scanPhase) * dt * 0.9;
        if (guard.wait <= 0) {
          guard.waypoint = (guard.waypoint + 1) % def.waypoints.length;
          guard.wait = 0;
        }
        return;
      }
    } else if (guard.mode === 'chase' || guard.mode === 'search' || guard.mode === 'curious') {
      dest = guard.target;
      const dist = Math.hypot(dest.x - guard.x, dest.y - guard.y);
      if (dist < 10) {
        if (guard.mode === 'chase') {
          // Reached the last seen spot and the thief is gone: look around, then give up.
          guard.mode = 'search';
          guard.searchLeft = GUARD.searchTime;
        } else if (guard.mode === 'curious') {
          guard.curiousLeft -= dt;
          if (guard.curiousLeft <= 0) guard.mode = 'return';
        } else {
          guard.searchLeft -= dt;
          guard.scanPhase += dt * 2;
          guard.facing += Math.sin(guard.scanPhase) * dt * 1.6;
          if (guard.searchLeft <= 0) guard.mode = 'return';
          return;
        }
      }
    } else if (guard.mode === 'return') {
      const def = FLOORS[state.floorIndex].guards[state.guards.indexOf(guard)];
      dest = def.waypoints[0];
      const dist = Math.hypot(dest.x - guard.x, dest.y - guard.y);
      if (dist < 8) {
        guard.mode = 'patrol';
        guard.waypoint = 0;
        guard.suspicion = 0;
        return;
      }
    }
    if (!dest) return;
    const dx = dest.x - guard.x;
    const dy = dest.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const step = (speed * dt) / dist;
    const nx = guard.x + dx * step;
    const ny = guard.y + dy * step;
    guard.facing = Math.atan2(dy, dx);
    moveCircle(floor, guard, nx - guard.x, ny - guard.y);
    // Footsteps: a guard close by is heard before it is seen.
    guard.stepTimer -= dt;
    if (guard.stepTimer <= 0) {
      guard.stepTimer = guard.mode === 'chase' ? 0.32 : 0.5;
      const d = Math.hypot(state.player.x - guard.x, state.player.y - guard.y);
      if (d < 260) playStep(guard.mode === 'chase', d);
    }
  }

  function step(dt, dir, sneaking, toss) {
    if (state.over || state.won) return 0;
    let events = 0;
    const floor = state.floor;
    const player = state.player;
    state.floorTime += dt;
    state.totalTime += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    // --- the thief moves ---
    const len = Math.hypot(dir.x, dir.y);
    player.moving = len > 0;
    player.sneaking = sneaking;
    if (len > 0) {
      const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const nx = (dir.x / len) * speed * dt;
      const ny = (dir.y / len) * speed * dt;
      player.facing = Math.atan2(dir.y, dir.x);
      moveCircle(floor, player, nx, ny);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = sneaking ? 0.55 : 0.34;
        playStep(!sneaking, 0);
      }
      // Running is loud: guards nearby turn toward the noise and grow wary.
      if (!sneaking) {
        for (const g of state.guards) {
          const d = Math.hypot(player.x - g.x, player.y - g.y);
          if (d < VISION.noiseRadius && g.mode !== 'chase') {
            g.facing = Math.atan2(player.y - g.y, player.x - g.x);
            g.suspicion = Math.min(0.85, g.suspicion + 0.25 * dt);
          }
        }
      }
    }

    // --- a tossed coin flies, lands and pings ---
    if (toss && state.coins.length > 0) {
      const coin = state.coins.pop();
      const tx = player.x + Math.cos(toss.angle) * GAME.coinThrow;
      const ty = player.y + Math.sin(toss.angle) * GAME.coinThrow;
      // The coin stops at the first wall in its path.
      let landX = tx;
      let landY = ty;
      for (let t = 0; t <= 1; t += 0.05) {
        const px = player.x + (tx - player.x) * t;
        const py = player.y + (ty - player.y) * t;
        if (hitsSolid(floor, px, py, 2)) break;
        landX = px;
        landY = py;
      }
      state.thrown.push({ x: landX, y: landY, timer: 1.2 });
      playCoin();
      for (const g of state.guards) {
        const d = Math.hypot(landX - g.x, landY - g.y);
        if (d < GAME.coinPingRadius && g.mode !== 'chase') {
          g.mode = 'curious';
          g.target = { x: landX, y: landY };
          g.curiousLeft = GAME.coinCuriousTime;
          g.suspicion = Math.max(0, g.suspicion - 0.2);
        }
      }
    }
    for (const t of state.thrown) t.timer -= dt;
    state.thrown = state.thrown.filter((t) => t.timer > 0);

    // --- relics ---
    for (const relic of floor.relics) {
      if (!relic.taken && Math.hypot(player.x - relic.x, player.y - relic.y) < 22) {
        relic.taken = true;
        state.relicsTaken += 1;
        state.score += GAME.relicScore;
        state.message = `Relic taken (${state.relicsTaken}/${floor.relics.length})`;
        state.messageTimer = 1.6;
        playPickup();
        events |= EVENT_PICKUP;
      }
    }

    // --- guards see, suspect, chase ---
    const hidden = inBush(floor, player.x, player.y);
    let anyoneSees = false;
    for (const guard of state.guards) {
      const { seen, dist } = inVisionCone(floor, guard, player.x, player.y);
      const reallySeen = seen && !(hidden && dist > VISION.bushRevealRange);
      if (reallySeen) {
        anyoneSees = true;
        guard.target = { x: player.x, y: player.y };
        if (guard.mode === 'patrol' || guard.mode === 'curious' || guard.mode === 'return') {
          let rate = VISION.fillBase * (VISION.fillFar + (1 - VISION.fillFar) * (1 - dist / VISION.range));
          if (inLanternLight(floor, player.x, player.y)) rate *= VISION.fillInLight;
          else rate *= VISION.fillInShadow;
          if (sneaking) rate *= VISION.fillSneaking;
          guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
          guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
          if (guard.suspicion >= 1) events |= startAlarm(guard);
        }
      } else if (guard.mode !== 'chase') {
        guard.suspicion = Math.max(0, guard.suspicion - VISION.drain * dt);
      }
      stepGuard(guard, dt);
      // Caught: a guard reaches the thief while the alarm is up.
      if (state.alarm && Math.hypot(player.x - guard.x, player.y - guard.y) < guard.radius + player.radius + 2) {
        events |= catchPlayer();
        return events;
      }
    }

    // --- the alarm dies down once nobody has seen the thief for a while ---
    if (state.alarm) {
      if (anyoneSees) state.alarmTimer = GUARD.alarmCalmTime;
      else {
        state.alarmTimer -= dt;
        if (state.alarmTimer <= 0) {
          state.alarm = false;
          for (const g of state.guards) {
            if (g.mode === 'chase') {
              g.mode = 'search';
              g.searchLeft = GUARD.searchTime;
            }
          }
          state.message = 'Lost them... for now.';
          state.messageTimer = 2;
        }
      }
    }

    // --- the exit opens once every relic is taken ---
    const allTaken = state.relicsTaken >= floor.relics.length;
    if (allTaken && Math.hypot(player.x - floor.exit.x, player.y - floor.exit.y) < 26) {
      events |= clearFloor();
      return events;
    }
    return events;
  }

  function reset() {
    state.lives = GAME.lives;
    state.score = 0;
    state.totalTime = 0;
    state.over = false;
    state.won = false;
    state.coins = Array.from({ length: GAME.coinsPerFloor }, () => ({}));
    loadFloor(0);
    state.message = `${FLOORS[0].name} — ${FLOORS[0].hint}`;
    state.messageTimer = 3.5;
  }

  // Coins refill on every floor load, so a fresh floor always starts with a full pocket.
  const baseLoadFloor = loadFloor;
  loadFloor = function loadFloorWithCoins(index) {
    baseLoadFloor(index);
    state.coins = Array.from({ length: GAME.coinsPerFloor }, () => ({}));
  };

  reset();
  return { state, step, reset, loadFloor };
}
