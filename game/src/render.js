// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Vision cones are painted over the floor and under the walls, so a
// wall cuts a cone the way it should. Everything is drawn in code: flat shapes,
// canvas gradients for lamplight, and text for the HUD and the panels.
import { COLS, FIELD, FONT, PALETTE, ROWS, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function wedge(x, y, angle, range, halfAngle, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
  }

  function drawFloor(state) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let tx = 0; tx <= COLS; tx += 1) {
      context.moveTo(tx * TILE, 0);
      context.lineTo(tx * TILE, FIELD.height);
    }
    for (let ty = 0; ty <= ROWS; ty += 1) {
      context.moveTo(0, ty * TILE);
      context.lineTo(FIELD.width, ty * TILE);
    }
    context.stroke();
    // Warm pools of light under the lamps.
    for (const lamp of state.lamps) {
      const glow = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, 110);
      glow.addColorStop(0, 'rgba(247, 201, 72, 0.20)');
      glow.addColorStop(1, 'rgba(247, 201, 72, 0)');
      context.fillStyle = glow;
      context.fillRect(lamp.x - 110, lamp.y - 110, 220, 220);
      context.fillStyle = PALETTE.lampGlow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const alert = guard.state === 'chase';
      const wary = guard.state === 'suspicious' || guard.detection > 0.45;
      const fill = alert ? PALETTE.coneAlert : wary ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      const edge = alert ? PALETTE.coneAlertEdge : wary ? PALETTE.coneSuspiciousEdge : PALETTE.coneCalmEdge;
      wedge(guard.x, guard.y, guard.angle, 250, 0.46, fill, edge);
    }
    for (const camera of state.cameras) {
      const wary = camera.detection > 0.45;
      wedge(
        camera.x,
        camera.y,
        camera.angle,
        230,
        0.42,
        wary ? PALETTE.coneSuspicious : PALETTE.coneCalm,
        wary ? PALETTE.coneSuspiciousEdge : PALETTE.coneCalmEdge,
      );
    }
  }

  function drawWallsAndCover(state) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        if (state.solid[ty * COLS + tx] !== 1) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        context.fillStyle = PALETTE.wall;
        context.fillRect(x, y, TILE, TILE);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(x, y, TILE, 5);
      }
    }
    // Crates sit on the solid grid too, but read as boxes, not wall: repaint them.
    for (const [cx, cy, w, h] of state.level.crates) {
      for (let ty = cy; ty < cy + h; ty += 1) {
        for (let tx = cx; tx < cx + w; tx += 1) {
          const x = tx * TILE;
          const y = ty * TILE;
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.fillStyle = PALETTE.crateTop;
          context.fillRect(x + 3, y + 3, TILE - 6, 8);
          context.strokeStyle = PALETTE.crateEdge;
          context.lineWidth = 2;
          context.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.beginPath();
          context.moveTo(x + 3, y + 3);
          context.lineTo(x + TILE - 3, y + TILE - 3);
          context.moveTo(x + TILE - 3, y + 3);
          context.lineTo(x + 3, y + TILE - 3);
          context.stroke();
        }
      }
    }
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        if (state.bush[ty * COLS + tx] !== 1) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        context.fillStyle = PALETTE.bush;
        context.fillRect(x, y, TILE, TILE);
        context.fillStyle = PALETTE.bushLeaf;
        for (let i = 0; i < 5; i += 1) {
          const bx = x + 6 + ((i * 13) % 28);
          const by = y + 6 + ((i * 17) % 28);
          context.beginPath();
          context.arc(bx, by, 6, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = PALETTE.bushDeep;
        context.beginPath();
        context.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRelicsAndExit(state, time) {
    for (const relic of state.relics) {
      if (relic.taken) continue;
      const pulse = 1 + Math.sin(time * 0.004 + relic.x) * 0.12;
      const glow = context.createRadialGradient(relic.x, relic.y, 2, relic.x, relic.y, 34 * pulse);
      glow.addColorStop(0, 'rgba(255, 217, 77, 0.5)');
      glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
      context.fillStyle = glow;
      context.fillRect(relic.x - 34, relic.y - 34, 68, 68);
      context.save();
      context.translate(relic.x, relic.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.relic;
      context.fillRect(-9, -9, 18, 18);
      context.fillStyle = PALETTE.relicGlow;
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    const exit = state.exit;
    const open = exit.open;
    const pulse = open ? 1 + Math.sin(time * 0.006) * 0.15 : 1;
    const glow = context.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, 46 * pulse);
    glow.addColorStop(0, open ? 'rgba(57, 217, 138, 0.55)' : 'rgba(90, 107, 98, 0.35)');
    glow.addColorStop(1, 'rgba(57, 217, 138, 0)');
    context.fillStyle = glow;
    context.fillRect(exit.x - 46, exit.y - 46, 92, 92);
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(exit.x - 16, exit.y - 16, 32, 32);
    context.fillStyle = PALETTE.backdrop;
    context.font = `bold 20px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(open ? '>' : 'x', exit.x, exit.y + 1);
    context.textBaseline = 'alphabetic';
    text(open ? 'EXIT OPEN' : 'LOCKED', exit.x, exit.y + 30, 11, open ? PALETTE.exit : PALETTE.muted, 'center');
  }

  function drawNoiseFlashes(state) {
    for (const flash of state.noiseFlashes) {
      const t = flash.age / 0.7;
      context.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - t)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(flash.x, flash.y, 10 + t * flash.radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawThrownCoin(state) {
    const coin = state.thrownCoin;
    if (!coin) return;
    const t = coin.t;
    const x = coin.x + (coin.tx - coin.x) * t;
    const y = coin.y + (coin.ty - coin.y) * t - Math.sin(t * Math.PI) * 26;
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff6c9';
    context.beginPath();
    context.arc(x - 1.5, y - 1.5, 2.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    const glow = context.createRadialGradient(p.x, p.y, 4, p.x, p.y, 46);
    glow.addColorStop(0, 'rgba(123, 92, 255, 0.30)');
    glow.addColorStop(1, 'rgba(123, 92, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(p.x - 46, p.y - 46, 92, 92);
    context.save();
    if (p.inBush) context.globalAlpha = 0.6;
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.arc(p.x, p.y, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#241a4d';
    context.beginPath();
    context.arc(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (p.running) {
      context.strokeStyle = 'rgba(242, 239, 230, 0.5)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(p.x, p.y, 19, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guardUniform;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b2f3a';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 8, Math.PI * 0.9, Math.PI * 2.1);
      context.fill();
      // The detection ring over the guard's head: it fills as he gets sure of you.
      if (guard.detection > 0.02) {
        context.strokeStyle = guard.detection > 0.75 ? PALETTE.danger : PALETTE.gold;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
        context.stroke();
      }
      if (guard.state === 'chase') {
        text('!', guard.x, guard.y - 26, 26, PALETTE.danger, 'center');
      } else if (guard.state === 'suspicious') {
        text('?', guard.x, guard.y - 26, 24, PALETTE.gold, 'center');
      }
    }
    for (const camera of state.cameras) {
      context.fillStyle = '#3a4152';
      context.fillRect(camera.x - 10, camera.y - 10, 20, 20);
      context.save();
      context.translate(camera.x, camera.y);
      context.rotate(camera.angle);
      context.fillStyle = '#c8ccd6';
      context.fillRect(0, -5, 16, 10);
      context.fillStyle = camera.detection > 0.45 ? PALETTE.danger : PALETTE.gold;
      context.beginPath();
      context.arc(16, 0, 3.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 20, 14, 24, PALETTE.text, 'left');
    text(state.level.name, FIELD.width / 2, 14, 24, PALETTE.text, 'center');
    // Relics: a diamond per relic, filled when stolen.
    const total = state.relics.length;
    const startX = FIELD.width - 220;
    text('Relics', startX - 10, 14, 24, PALETTE.text, 'right');
    for (let i = 0; i < total; i += 1) {
      const x = startX + i * 26 + 13;
      const y = 28;
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillStyle = state.relics[i].taken ? PALETTE.relic : '#3a4152';
      context.fillRect(-7, -7, 14, 14);
      context.restore();
    }
    // Lives as hearts.
    const livesX = FIELD.width - 220 + total * 26 + 16;
    text('Lives', livesX - 6, 14, 24, PALETTE.text, 'left');
    let hx = livesX + 58;
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.danger : '#3a4152';
      context.beginPath();
      context.arc(hx, 26, 7, 0, Math.PI * 2);
      context.fill();
      hx += 20;
    }
    // The loudest alarm in the room: a thin bar under the HUD.
    let worst = 0;
    for (const guard of state.guards) worst = Math.max(worst, guard.detection);
    for (const camera of state.cameras) worst = Math.max(worst, camera.detection);
    if (worst > 0.02) {
      context.fillStyle = '#3a4152';
      context.fillRect(FIELD.width / 2 - 120, 46, 240, 8);
      context.fillStyle = worst > 0.75 ? PALETTE.danger : PALETTE.gold;
      context.fillRect(FIELD.width / 2 - 120, 46, 240 * worst, 8);
      text(worst > 0.75 ? 'SPOTTED' : 'SEEN', FIELD.width / 2 + 130, 42, 16, worst > 0.75 ? PALETTE.danger : PALETTE.gold, 'left');
    }
    // Coins left and the controls, along the bottom.
    text(`Coins ${state.coinsLeft}  (click to toss one)`, 20, FIELD.height - 30, 17, PALETTE.muted, 'left');
    text('WASD / arrows move   Shift run (loud)   P pause', FIELD.width - 20, FIELD.height - 30, 17, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Three floors of the Old Museum. Steal every relic, slip out unseen.',
    'Guards patrol with lantern cones. Bushes hide you, crates block sight.',
    'Running is loud. Click to toss a coin and pull a guard away.',
    'Cameras sweep the later floors. If a guard catches you, you lose a life.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the floor, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, info) {
    const time = performance.now();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawCones(state);
    drawWallsAndCover(state);
    drawRelicsAndExit(state, time);
    drawNoiseFlashes(state);
    drawThrownCoin(state);
    drawPlayer(state);
    drawGuards(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('LANTERN HEIST', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      const lines = [
        `${info.clearedName} cleared.`,
        `Time bonus +${info.timeBonus}   ${info.ghost > 0 ? `Ghost bonus +${info.ghost}` : 'Spotted: no ghost bonus'}`,
        `Score ${state.score}`,
        '',
      ];
      drawPanel('Floor cleared', lines, info.win ? '' : 'Press Space for the next floor', PALETTE.ok);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Caught', OVER_LINES, 'Press Space or click to try again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      const lines = [
        'Every relic is yours. The museum never knew you were there.',
        finalLabel(state.score),
        bestLabel(best),
        '',
      ];
      drawPanel('Clean getaway', lines, 'Press Space or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
