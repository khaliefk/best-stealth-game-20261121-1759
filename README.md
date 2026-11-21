# Lantern Heist

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![make.fun bounty](https://img.shields.io/badge/make.fun-best--stealth--game-blue)](https://make.fun/c/best-stealth-game-20261121-1759)
[![Node](https://img.shields.io/badge/Node-%3E%3D22.18-green)](https://nodejs.org)

A top-down stealth game for the [make.fun](https://make.fun/c/best-stealth-game-20261121-1759)
"Make the best stealth game" bounty. You are a thief in a dark manor: sneak past the guards,
steal every relic, and slip out the exit unseen.

## How it plays

- **Three floors** — the Ground Floor, the Gallery, and the Vault. Each one has more guards,
  faster patrols, and more relics to steal.
- **Guards with vision cones** — cones are ray-cast, so walls, crates and bushes really block
  sight. A suspicion ring fills while you are seen; fill it and the alarm goes up.
- **Detection that gives you a chance** — sneak (Shift) to halve how fast you are spotted,
  hide in bushes, stay out of lantern light, and break line of sight to let the alarm die down.
- **Coins to toss** — Q or click throws a coin; guards nearby walk over to investigate the ping.
- **Running is loud** — guards close by hear it and turn toward you.

## Controls

| Key | What it does |
| --- | --- |
| WASD / arrows | Move |
| Shift | Sneak (slower, quieter, harder to spot) |
| Q or mouse click | Toss a coin toward the mouse |
| P / Esc | Pause |
| Enter / click | Start, continue |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files and every sound is made with the
Web Audio API.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored `vendor/makefun-game.ts` library.

## Layout

- `game/src/config.js` — tuning: speeds, vision, detection, palette
- `game/src/levels.js` — the three floors (grids + guard patrols)
- `game/src/vision.js` — line of sight, vision cones, lantern light
- `game/src/world.js` — rules: movement, guards, alarm, relics, win/lose
- `game/src/render.js` — canvas painting, lighting, HUD, screens
- `game/src/audio.js` — procedural Web Audio sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — staged screenshot scenes (`?shot=start|play|alarm|win`)
- `game/src/main.js` — boot and the game loop
