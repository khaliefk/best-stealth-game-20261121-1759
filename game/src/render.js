// Lantern Heist: everything the player sees. Top-down canvas painting: wooden floors, stone
// walls, crates and bushes, warm lantern pools, relics, the exit door, guards with ray-cast
// vision cones that stop at walls, the hooded thief, and a darkness pass that leaves light
// only around the thief and the lanterns. The HUD and the title, pause, clear, caught and
// victory screens are drawn here too, so a screenshot is always one draw call away.
import { COLORS, COLS, GAME, ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH, VISION } from './config.js';
import { FLOORS, isSolid } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** A cheap deterministic hash, so each floor tile gets its own stable shade and speckle. */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function createRenderer(canvas) {
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = VIEW_WIDTH;
  dark.height = VIEW_HEIGHT;
  const dctx = dark.getContext('2d');

  function drawFloor(floor) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const x = tx * TILE;
        const y = ty * TILE;
        const h = hash2(tx, ty);
        if (floor.walls.has(`${tx},${ty}`)) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillStyle = COLORS.wallDark;
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + 8, y + 10, 3, 3);
          ctx.fillRect(x + 20, y + 18, 3, 3);
          continue;
        }
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        // Wood planks: a darker seam every other row and a speckle per tile.
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
        if (ty % 2 === 0) ctx.fillRect(x + (h > 0.5 ? 16 : 0), y, 1, TILE);
        ctx.fillStyle = `rgba(255,220,150,${0.02 + h * 0.03})`;
        ctx.fillRect(x + 4 + h * 20, y + 6 + h * 16, 3, 3);
        if (floor.cover.has(`${tx},${ty}`)) {
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = COLORS.crateEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        } else if (floor.bushes.has(`${tx},${ty}`)) {
          ctx.fillStyle = COLORS.bush;
          ctx.beginPath();
          ctx.arc(x + 10, y + 12, 9, 0, Math.PI * 2);
          ctx.arc(x + 22, y + 10, 10, 0, Math.PI * 2);
          ctx.arc(x + 16, y + 22, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.bushLight;
          ctx.beginPath();
          ctx.arc(x + 12, y + 10, 4, 0, Math.PI * 2);
          ctx.arc(x + 22, y + 20, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Lanterns: a post, a warm core and a pool of light on the floor.
    for (const lamp of floor.lanterns) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 110);
      glow.addColorStop(0, COLORS.lanternGlow);
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(lamp.x - 2, lamp.y - 12, 4, 24);
      ctx.fillStyle = COLORS.lanternCore;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExit(floor, taken, time) {
    const e = floor.exit;
    const open = taken;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.globalAlpha = open ? 0.5 + 0.4 * pulse : 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#101018';
    ctx.fillRect(-11, -14, 22, 28);
    ctx.fillStyle = open ? COLORS.exitOpen : COLORS.exitLocked;
    ctx.fillRect(-11, -14, 22, 4);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCK', 0, 1);
    ctx.restore();
  }

  function drawRelics(floor, time) {
    for (const relic of floor.relics) {
      if (relic.taken) continue;
      const bob = Math.sin(time * 2 + relic.x) * 3;
      const glow = ctx.createRadialGradient(relic.x, relic.y + bob, 2, relic.x, relic.y + bob, 30);
      glow.addColorStop(0, COLORS.relicGlow);
      glow.addColorStop(1, 'rgba(255,217,74,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(relic.x, relic.y + bob, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(relic.x, relic.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.relic;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      if (Math.sin(time * 4 + relic.y) > 0.6) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(relic.x + 10, relic.y - 12 + bob, 2, 2);
      }
    }
  }

  /** Cast one ray of the cone until it hits a wall or runs out of range. */
  function rayLength(floor, gx, gy, angle) {
    const step = 6;
    for (let d = step; d <= VISION.range; d += step) {
      const x = gx + Math.cos(angle) * d;
      const y = gy + Math.sin(angle) * d;
      if (isSolid(floor, Math.floor(x / TILE), Math.floor(y / TILE))) return d;
    }
    return VISION.range;
  }

  function drawCones(floor, guards, alarm) {
    for (const guard of guards) {
      const rays = 26;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      for (let i = 0; i <= rays; i += 1) {
        const a = guard.facing - VISION.halfAngle + (2 * VISION.halfAngle * i) / rays;
        const len = rayLength(floor, guard.x, guard.y, a);
        ctx.lineTo(guard.x + Math.cos(a) * len, guard.y + Math.sin(a) * len);
      }
      ctx.closePath();
      ctx.fillStyle = alarm
        ? COLORS.coneAlarm
        : guard.suspicion > 0.35
          ? COLORS.coneSuspicious
          : COLORS.coneCalm;
      ctx.fill();
    }
  }

  function drawGuard(guard, alarm, time) {
    // A coloured ring under the guard shows how suspicious it is.
    if (guard.suspicion > 0.05) {
      ctx.strokeStyle = guard.suspicion > 0.7 ? '#ff5040' : '#ffb020';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 18, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.facing);
    // Body: a dark blue tabard with a helmet and a spear pointing where it looks.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(0, 0, guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardHelmet;
    ctx.beginPath();
    ctx.arc(2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.restore();
    if (alarm || guard.suspicion > 0.85) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 22 - Math.sin(time * 6) * 2);
    }
  }

  function drawPlayer(player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    // A soft pool of light the thief carries.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    glow.addColorStop(0, 'rgba(255,220,140,0.25)');
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(player.facing);
    // Hooded cloak: a triangle with a round head and a little lantern at the belt.
    ctx.fillStyle = COLORS.playerCloak;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(1, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.lanternCore;
    ctx.beginPath();
    ctx.arc(-4, 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.sneaking) {
      ctx.fillStyle = 'rgba(242,232,213,0.85)';
      ctx.font = '11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', player.x, player.y - 20);
    }
  }

  function drawThrown(thrown, time) {
    for (const t of thrown) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4 + Math.sin(time * 10) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,217,74,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 12 + (1.2 - t.timer) * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** The darkness pass: dim the whole floor, then cut light holes around the thief and lamps. */
  function drawDarkness(state) {
    dctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    dctx.fillStyle = COLORS.shadow;
    dctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    dctx.globalCompositeOperation = 'destination-out';
    const p = state.player;
    let g = dctx.createRadialGradient(p.x, p.y, 30, p.x, p.y, 215);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(p.x, p.y, 215, 0, Math.PI * 2);
    dctx.fill();
    for (const lamp of state.floor.lanterns) {
      g = dctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, 130);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(lamp.x, lamp.y, 130, 0, Math.PI * 2);
      dctx.fill();
    }
    const e = state.floor.exit;
    if (state.relicsTaken >= state.floor.relics.length) {
      g = dctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, 90);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(e.x, e.y, 90, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
  }

  function drawHud(state, time) {
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, VIEW_WIDTH, 40);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.floor.name, 14, 21);
    ctx.font = '14px Georgia, serif';
    const right = [
      `◆ ${state.relicsTaken}/${state.floor.relics.length}`,
      `${'♥'.repeat(Math.max(0, state.lives))}${'·'.repeat(Math.max(0, GAME.lives - state.lives))}`,
      `● ${state.coins.length}`,
      `Score ${state.score}`,
      `${Math.floor(state.floorTime / 60)}:${String(Math.floor(state.floorTime % 60)).padStart(2, '0')}`,
    ].join('    ');
    ctx.textAlign = 'right';
    ctx.fillText(right, VIEW_WIDTH - 14, 21);
    if (state.alarm) {
      ctx.fillStyle = Math.sin(time * 8) > 0 ? 'rgba(200,30,20,0.9)' : 'rgba(140,20,10,0.9)';
      ctx.fillRect(0, 40, VIEW_WIDTH, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('— ALARM — guards are hunting you —', VIEW_WIDTH / 2, 54);
    }
    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = 'rgba(10,10,14,0.75)';
      const w = ctx.measureText(state.message).width + 28;
      ctx.fillRect((VIEW_WIDTH - w) / 2, VIEW_HEIGHT - 52, w, 32);
      ctx.fillStyle = COLORS.text;
      ctx.font = '14px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW_WIDTH / 2, VIEW_HEIGHT - 35);
    }
    ctx.textAlign = 'left';
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6,8,16,0.55)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = accent || COLORS.text;
    ctx.font = 'bold 52px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 90);
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px Georgia, serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 30 + i * 30);
    });
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '15px Georgia, serif';
    ctx.fillText('Press Enter or click to continue', VIEW_WIDTH / 2, VIEW_HEIGHT - 70);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best, time) {
    const floor = state.floor;
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawFloor(floor);
    drawExit(floor, state.relicsTaken >= floor.relics.length, time);
    drawRelics(floor, time);
    drawCones(floor, state.guards, state.alarm);
    for (const guard of state.guards) drawGuard(guard, state.alarm, time);
    drawPlayer(state.player, time);
    drawThrown(state.thrown, time);
    drawDarkness(state);
    if (screen === SCREEN_TITLE) {
      overlay('LANTERN HEIST', [
        'A top-down stealth game in three floors.',
        'Steal every relic, then slip out the green exit — unseen.',
        'WASD / arrows to move · Shift to sneak · Q or click to toss a coin',
        'Lantern light gives you away. Bushes hide you. Running is loud.',
      ]);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '15px Georgia, serif';
      ctx.textAlign = 'center';
      if (best > 0) ctx.fillText(`Best score: ${best}`, VIEW_WIDTH / 2, VIEW_HEIGHT - 100);
      ctx.textAlign = 'left';
      return;
    }
    drawHud(state, time);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Take a breath. The guards wait for no one, but the game does.'], COLORS.text);
    } else if (screen === SCREEN_CLEAR) {
      overlay('FLOOR CLEARED', [`Score ${state.score}`, 'The next floor is darker. The guards are faster.'], COLORS.exitOpen);
    } else if (screen === SCREEN_OVER) {
      overlay('CAUGHT', [`The manor keeps its relics this time.`, `Score ${state.score} · Best ${Math.max(best, state.score)}`], '#ff5040');
    } else if (screen === SCREEN_WIN) {
      const mins = Math.floor(state.totalTime / 60);
      const secs = Math.floor(state.totalTime % 60);
      overlay('THE HEIST IS DONE', [
        'Every relic, every floor, and never once spotted.',
        `Final score ${state.score} · Time ${mins}:${String(secs).padStart(2, '0')}`,
        `Best ${Math.max(best, state.score)}`,
      ], COLORS.relic);
    }
  }

  return { draw };
}
