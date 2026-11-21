// The three floors of the Old Museum, in tile coordinates (32 by 18 tiles).
// A level is walls, crates and bushes placed on a floor, plus relics to steal,
// an exit, the player's start, guard patrols and (later floors) sweeping cameras.
// Walls and crates block movement and sight; bushes hide the player; lamps are
// just warm pools of light on the floor.

export const LEVELS = [
  {
    name: 'The Quiet Wing',
    hint: 'Walk slow, stay out of the yellow cones. Grab every relic, then reach the green door.',
    walls: [
      [10, 3, 4, 2],
      [18, 3, 4, 2],
      [10, 10, 4, 2],
      [24, 6, 4, 3],
      [5, 13, 2, 3],
    ],
    crates: [
      [15, 6, 2, 1],
      [22, 10, 1, 2],
      [7, 9, 1, 1],
      [26, 13, 2, 1],
    ],
    bushes: [
      [6, 1, 2, 1],
      [16, 1, 2, 1],
      [3, 5, 1, 2],
      [13, 8, 2, 1],
      [24, 15, 2, 1],
      [2, 14, 1, 2],
    ],
    lamps: [
      [8, 8],
      [20, 8],
      [14, 14],
    ],
    relics: [
      [25, 4],
      [7, 12],
      [15, 16],
    ],
    exit: [29, 16],
    player: [3, 2],
    guards: [
      { waypoints: [[6, 7], [20, 7]] },
      { waypoints: [[23, 3], [23, 13]] },
    ],
    cameras: [],
  },
  {
    name: 'The Marble Hall',
    hint: 'Cameras sweep the middle. Watch the red cone, wait for the sweep to pass.',
    walls: [
      [8, 2, 3, 4],
      [20, 2, 3, 4],
      [8, 12, 3, 4],
      [20, 12, 3, 4],
      [14, 7, 4, 2],
    ],
    crates: [
      [3, 8, 2, 1],
      [27, 8, 2, 1],
      [14, 3, 2, 1],
      [14, 14, 2, 1],
    ],
    bushes: [
      [2, 2, 2, 1],
      [28, 2, 2, 1],
      [2, 15, 2, 1],
      [28, 15, 2, 1],
      [11, 8, 1, 2],
      [20, 8, 1, 2],
    ],
    lamps: [
      [6, 5],
      [25, 5],
      [6, 13],
      [25, 13],
    ],
    relics: [
      [15, 2],
      [4, 9],
      [27, 9],
      [15, 15],
    ],
    exit: [29, 8],
    player: [2, 8],
    guards: [
      { waypoints: [[5, 6], [12, 6], [12, 11], [5, 11]] },
      { waypoints: [[26, 6], [19, 6], [19, 11], [26, 11]] },
      { waypoints: [[13, 6], [18, 6]] },
    ],
    cameras: [
      { tile: [15, 1], baseAngle: Math.PI / 2, sweep: 0.9 },
    ],
  },
  {
    name: 'The Vault Floor',
    hint: 'Four guards, two cameras, five relics. Run only when nobody can hear you.',
    walls: [
      [6, 3, 2, 6],
      [24, 3, 2, 6],
      [6, 10, 2, 5],
      [24, 10, 2, 5],
      [13, 7, 6, 2],
      [13, 2, 2, 3],
      [17, 13, 2, 3],
    ],
    crates: [
      [10, 5, 1, 2],
      [21, 5, 1, 2],
      [10, 12, 1, 2],
      [21, 12, 1, 2],
      [15, 9, 2, 1],
    ],
    bushes: [
      [3, 3, 1, 2],
      [28, 3, 1, 2],
      [3, 14, 1, 2],
      [28, 14, 1, 2],
      [15, 5, 2, 1],
      [15, 12, 2, 1],
    ],
    lamps: [
      [4, 8],
      [27, 8],
      [11, 8],
      [20, 8],
    ],
    relics: [
      [15, 1],
      [4, 15],
      [27, 15],
      [15, 16],
      [8, 8],
    ],
    exit: [29, 1],
    player: [2, 1],
    guards: [
      { waypoints: [[9, 6], [9, 14]] },
      { waypoints: [[22, 6], [22, 14]] },
      { waypoints: [[12, 3], [12, 14]] },
      { waypoints: [[9, 16], [20, 16]] },
    ],
    cameras: [
      { tile: [10, 1], baseAngle: Math.PI / 2, sweep: 1.0 },
      { tile: [21, 16], baseAngle: -Math.PI / 2, sweep: 1.0 },
    ],
  },
];
