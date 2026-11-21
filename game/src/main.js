// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, floor cleared, game
// over and clean getaway.
//
// ?seed=N is accepted and ignored (the levels are fixed); ?shot=start|play|alert|win
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__game = { world, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.info);
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
  let clearInfo = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  /** Turn a click's client coordinates into world coordinates on the playfield. */
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const view = renderer.view;
    return {
      x: ((clientX - rect.left) * ratio - view.x) / view.scale,
      y: ((clientY - rect.top) * ratio - view.y) / view.scale,
    };
  }

  function drainSounds() {
    const events = world.state.events;
    const p = world.state.player;
    for (const event of events) {
      if (event.type === 'playerStep') audio.playerStep(event.loud);
      else if (event.type === 'guardStep') audio.guardStep(Math.hypot(event.x - p.x, event.y - p.y));
      else if (event.type === 'relic') audio.relic();
      else if (event.type === 'coinLand') audio.coinLand();
      else if (event.type === 'spotted') audio.spotted();
      else if (event.type === 'caught') audio.caught();
      else if (event.type === 'levelClear') audio.levelClear();
    }
    events.length = 0;
  }

  function startGame() {
    world.resetRun();
    clearInfo = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. ${world.state.level.name}. Steal every relic, then reach the exit.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    announce(won ? `Clean getaway. Score ${world.state.score}.` : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (screen === SCREEN_PLAY && click) {
      const target = toWorld(click.clientX, click.clientY);
      if (target.x >= 0 && target.y >= 0 && target.x <= FIELD.width && target.y <= FIELD.height) {
        world.state.pendingThrow = target;
      }
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) {
      clearInfo = null;
      screen = SCREEN_PLAY;
      announce(`Playing. ${world.state.level.name}.`);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: guards patrol, nothing can catch the player.
      const events = world.step(STEP, { mx: 0, my: 0, run: false, throwCoin: null });
      void events;
      world.state.events.length = 0;
      return;
    }
    const move = input.move();
    const throwCoin = world.state.pendingThrow ?? null;
    world.state.pendingThrow = null;
    const events = world.step(STEP, { mx: move.mx, my: move.my, run: input.running(), throwCoin });
    drainSounds();
    if (events & EVENT_LEVEL_CLEAR) {
      clearInfo = world.state.lastClear || null;
      if (events & EVENT_WIN) {
        endGame(true);
      } else {
        screen = SCREEN_CLEAR;
        announce(`${clearInfo ? clearInfo.clearedName : 'Floor'} cleared.`);
      }
    } else if (events & EVENT_GAME_OVER) {
      endGame(false);
    } else if (events & EVENT_CAUGHT) {
      announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, clearInfo);
  }

  // Leaving the tab pauses a running game rather than letting guards walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lantern Heist. Press Space or click to start.');
  // A handle for automated playtests: the world and the current screen, read-only.
  window.__game = { world, get screen() { return screen; } };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
