// Lantern Heist: boot and the one loop. Input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between six screens:
// title, play, paused, floor cleared, caught and victory.
//
// ?seed=N fixes the guards' starting phase. ?shot=start|play|alarm|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { GAME, STEP } from './config.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_TOSS, createInput } from './input.js';
import {
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { toggleMute, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

/** A small seeded generator, so ?seed=N always stages the same frame. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = mulberry32(seed);
const originalRandom = Math.random;
Math.random = random;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);

// A tiny read-only hook for automated playtests: position, alarm, lives, relics, floor, score.
window.__debugState = () => ({
  x: Math.round(world.state.player.x),
  y: Math.round(world.state.player.y),
  alarm: world.state.alarm,
  lives: world.state.lives,
  relics: world.state.relicsTaken,
  floor: world.state.floorIndex,
  score: world.state.score,
  over: world.state.over,
  won: world.state.won,
});

Math.random = originalRandom;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(GAME.bestKey) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(GAME.bestKey, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let clearShownAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    unlockAudio();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${GAME.lives} lives. Steal every relic, then reach the exit.`);
  }

  function finishRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function step(dt, dir, sneaking, toss) {
    const events = world.step(dt, dir, sneaking, toss);
    if (events & EVENT_ALARM) announce('Spotted! Break line of sight!');
    if (events & EVENT_CAUGHT) announce(`Caught. ${world.state.lives} lives left.`);
    if (events & EVENT_CLEAR) {
      screen = SCREEN_CLEAR;
      clearShownAt = time;
      announce('Floor cleared.');
    }
    if (events & EVENT_WIN) {
      screen = SCREEN_WIN;
      finishRun();
      announce('The heist is done.');
    }
    if (events & EVENT_OVER) {
      screen = SCREEN_OVER;
      finishRun();
      announce(`Caught. Game over. Score ${world.state.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    const clicked = input.mouse().clicked;
    const actions = input.takeActions();
    const wasPlaying = screen === SCREEN_PLAY;
    if (actions & ACTION_MUTE) {
      const muted = toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (screen === SCREEN_CLEAR && time - clearShownAt > 2.2) {
      screen = SCREEN_PLAY;
    }
    if (screen === SCREEN_TITLE) {
      // The manor lives behind the title card: guards keep patrolling.
      world.step(dt, { x: 0, y: 0 }, false, null);
    } else if (screen === SCREEN_PLAY) {
      let toss = null;
      if (wasPlaying && actions & ACTION_TOSS) {
        const p = world.state.player;
        const angle = clicked
          ? Math.atan2(input.mouse().y - p.y, input.mouse().x - p.x)
          : p.facing;
        toss = { angle };
      }
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(STEP, input.direction(), input.sneaking(), toss);
        toss = null;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lantern Heist. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
