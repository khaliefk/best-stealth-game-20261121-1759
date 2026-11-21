// Lantern Heist: the three floors. Each floor is a grid of characters, 40 wide and 22 tall:
//
//   # wall          C crate (blocks movement and sight)
//   T table (blocks movement and sight, lower than a crate)
//   B bush (walkable, blocks sight, hides the thief inside it)
//   L lantern (floor tile with a lamp; its light makes the thief easier to spot)
//   R relic         E exit door     P where the thief starts     . open floor
//
// Guards are not in the grid: each floor lists them with a spawn tile and patrol waypoints,
// so a patrol route never has to squeeze through a wall by accident.
import { COLS, ROWS } from './config.js';

const FLOOR_1 = [
  '########################################',
  '#........#.........#.........#.........#',
  '#..P.....#....R....#....C....#....R....#',
  '#........#.........#.........#.........#',
  '#..C.....#.........#....C....#....C....#',
  '#........#.........#.........#.........#',
  '####.#####....######....#####....####.##',
  '#......................................#',
  '#..B.......C..........C........B.......#',
  '#......................................#',
  '#....######.......#######........###...#',
  '#......................................#',
  '#..C.......B..........C.......B....C...#',
  '#......................................#',
  '####.#######....########....#######.####',
  '#........#.........#.........#.........#',
  '#..C.....#....C....#....B....#....C....#',
  '#........#.........#.........#.........#',
  '#........#.........#.........#.........#',
  '#........#....E....#....R....#.........#',
  '#........#.........#.........#.........#',
  '########################################',
];

const FLOOR_2 = [
  '########################################',
  '#....R.....#..........#..........#.....#',
  '#..P......#....C.....#....B.....#..R...#',
  '#.........#..........#..........#......#',
  '#...C.....#....B.....#....C.....#......#',
  '###.########....##########....######.###',
  '#......................................#',
  '#....C......B.......L........C......B..#',
  '#......................................#',
  '#..#######........########.......#####.#',
  '#......................................#',
  '#..B.......C..........C.......B........#',
  '#......................................#',
  '#...#####.........######........####...#',
  '#......................................#',
  '###.########....########....#########.##',
  '#..........#.........#..........#......#',
  '#..C.......#....R....#....C.....#...R..#',
  '#..........#.........#..........#......#',
  '#....B.....#....C....#....B.....#..E...#',
  '#..........#.........#..........#......#',
  '########################################',
];

const FLOOR_3 = [
  '########################################',
  '#..P...#......R.....#......C....#......#',
  '#......#............#...........#..R...#',
  '#..C...#....B.......#....B......#......#',
  '#......#............#...........#......#',
  '####.#####....########....#######...####',
  '#......................................#',
  '#....C.....B........L.......C.....B....#',
  '#......................................#',
  '#..########......#########......######.#',
  '#......................................#',
  '#...B......C..........C........B.......#',
  '#......................................#',
  '#....######.......########........###..#',
  '#......................................#',
  '####.#######....#########....#######.###',
  '#........#.........#..........#........#',
  '#..C.....#...R....#....C.....#...B.....#',
  '#........#.........#..........#........#',
  '#...B....#...C....#....B.....#....E....#',
  '#........#.........#..........#........#',
  '########################################',
];

/** Turn one grid of characters into the sets and lists the world works with. */
function parseFloor(grid, def) {
  const walls = new Set();
  const cover = new Set();
  const bushes = new Set();
  const lanterns = [];
  const relics = [];
  let exit = null;
  let playerStart = null;
  const key = (x, y) => `${x},${y}`;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = grid[y][x];
      if (ch === '#') walls.add(key(x, y));
      else if (ch === 'C' || ch === 'T') cover.add(key(x, y));
      else if (ch === 'B') bushes.add(key(x, y));
      else if (ch === 'L') lanterns.push({ x: x * 32 + 16, y: y * 32 + 16 });
      else if (ch === 'R') relics.push({ tx: x, ty: y, x: x * 32 + 16, y: y * 32 + 16, taken: false });
      else if (ch === 'E') exit = { tx: x, ty: y, x: x * 32 + 16, y: y * 32 + 16 };
      else if (ch === 'P') playerStart = { x: x * 32 + 16, y: y * 32 + 16 };
    }
  }
  return {
    name: def.name,
    hint: def.hint,
    walls,
    cover,
    bushes,
    lanterns,
    relics,
    exit,
    playerStart,
    guards: def.guards.map((g) => ({
      spawn: { x: g.spawn[0] * 32 + 16, y: g.spawn[1] * 32 + 16 },
      waypoints: g.waypoints.map(([wx, wy]) => ({ x: wx * 32 + 16, y: wy * 32 + 16 })),
    })),
  };
}

export const FLOORS = [
  parseFloor(FLOOR_1, {
    name: 'Floor 1 — The Ground Floor',
    hint: 'Three relics, three guards. Learn the patrols before you move.',
    guards: [
      { spawn: [5, 8], waypoints: [[5, 8], [34, 8], [34, 12], [5, 12]] },
      { spawn: [11, 2], waypoints: [[11, 2], [17, 2], [17, 4], [11, 4]] },
      { spawn: [20, 17], waypoints: [[20, 17], [27, 17], [27, 19], [20, 19]] },
    ],
  }),
  parseFloor(FLOOR_2, {
    name: 'Floor 2 — The Gallery',
    hint: 'Four guards and longer sightlines. The bushes are your friends.',
    guards: [
      { spawn: [4, 7], waypoints: [[4, 7], [35, 7], [35, 11], [4, 11]] },
      { spawn: [13, 2], waypoints: [[13, 2], [13, 4], [18, 4], [18, 2]] },
      { spawn: [30, 13], waypoints: [[30, 13], [30, 17], [36, 17], [36, 13]] },
      { spawn: [8, 18], waypoints: [[8, 18], [8, 20], [16, 20], [16, 18]] },
    ],
  }),
  parseFloor(FLOOR_3, {
    name: 'Floor 3 — The Vault',
    hint: 'Five guards, four relics, no easy way out. Stay in the dark.',
    guards: [
      { spawn: [6, 7], waypoints: [[6, 7], [34, 7], [34, 11], [6, 11]] },
      { spawn: [12, 2], waypoints: [[12, 2], [17, 2], [17, 4], [12, 4]] },
      { spawn: [25, 2], waypoints: [[25, 2], [30, 2], [30, 4], [25, 4]] },
      { spawn: [10, 17], waypoints: [[10, 17], [10, 19], [17, 19], [17, 17]] },
      { spawn: [26, 13], waypoints: [[26, 13], [33, 13], [33, 18], [26, 18]] },
    ],
  }),
];

/** A tile is solid when a wall or a piece of cover stands on it. */
export function isSolid(floor, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const key = `${tx},${ty}`;
  return floor.walls.has(key) || floor.cover.has(key);
}

/** A tile is a bush when the thief can stand in it and guards cannot see through it. */
export function isBush(floor, tx, ty) {
  return floor.bushes.has(`${tx},${ty}`);
}
