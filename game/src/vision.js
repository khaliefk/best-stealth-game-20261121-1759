// Lantern Heist: what a guard can see. Sight is a cone with a range and a half-angle, cut by
// walls, crates and bushes: a tile grid ray walk (Bresenham) says whether two points have a
// clear line between them, and the cone test says whether a point sits inside the facing wedge.
import { TILE, VISION } from './config.js';
import { isBush, isSolid } from './levels.js';

/** Walk the tiles between two pixel points; false the moment a solid tile gets in the way. */
export function hasLineOfSight(floor, x0, y0, x1, y1) {
  let tx0 = Math.floor(x0 / TILE);
  let ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE);
  const ty1 = Math.floor(y1 / TILE);
  const dx = Math.abs(tx1 - tx0);
  const dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1;
  const sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (tx0 === tx1 && ty0 === ty1) return true;
    // A bush blocks sight only when neither end stands inside it.
    const endTile = (tx0 === Math.floor(x0 / TILE) && ty0 === Math.floor(y0 / TILE))
      || (tx0 === tx1 && ty0 === ty1);
    if (!endTile && (isSolid(floor, tx0, ty0) || isBush(floor, tx0, ty0))) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      tx0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      ty0 += sy;
    }
  }
}

/** Is the point (x, y) inside the guard's vision cone, with a clear line to it? */
export function inVisionCone(floor, guard, x, y) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION.range || dist < 1) return { seen: false, dist };
  const toTarget = Math.atan2(dy, dx);
  let diff = toTarget - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > VISION.halfAngle) return { seen: false, dist };
  if (!hasLineOfSight(floor, guard.x, guard.y, x, y)) return { seen: false, dist };
  return { seen: true, dist };
}

/** Is the point inside any lantern's warm pool of light? Light makes the thief easier to spot. */
export function inLanternLight(floor, x, y) {
  for (const lamp of floor.lanterns) {
    if (Math.hypot(x - lamp.x, y - lamp.y) < 110) return true;
  }
  return false;
}

/** Is the point inside a bush? A thief in a bush is hidden unless a guard is right on top. */
export function inBush(floor, x, y) {
  return isBush(floor, Math.floor(x / TILE), Math.floor(y / TILE));
}
