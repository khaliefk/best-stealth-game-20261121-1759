[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 22](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![make.fun bounty](https://img.shields.io/badge/make.fun-best--stealth--game-blue.svg)](https://make.fun/c/best-stealth-game-20261121-1759)

# Lantern Heist

A top-down stealth game that runs offline in a desktop browser from static files.
You are Moth, a thief working three floors of the Old Museum after dark. Steal every
relic on the floor, then slip out the green exit without being seen.

## How it plays

- **Guards patrol with lantern cones.** Step into a cone and the guard's detection
  ring fills. Fill it all the way and he chases you. If he catches you, you lose a
  life and wake up back at the floor entrance.
- **Bushes hide you.** Crouch in the dark green bushes and guards barely see you.
  Crates and walls block sight completely.
- **Running is loud.** Hold Shift to run, but guards hear your footsteps and come to
  look. Walk when they are near.
- **Click to toss a coin.** A thrown coin clinks and pulls every guard in earshot
  toward the sound. You carry three per floor.
- **Cameras sweep the later floors.** Their cones work like a guard's, and a camera
  that spots you sends the nearest guard running.
- **Three floors, escalating.** The Quiet Wing, The Marble Hall, then The Vault Floor
  with four guards and two cameras. Clear a floor unseen for a ghost bonus.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Run (loud) |
| Mouse click | Toss a coin to distract guards |
| Space / Enter | Start, continue |
| P / Esc | Pause |

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network:
every file the game loads sits under `game/`.

## Layout

- `game/index.html` — the page, one canvas
- `game/src/main.js` — boot, the fixed-step loop, the six screens
- `game/src/world.js` — the rules: guards, cones, cameras, noise, relics, exits
- `game/src/levels.js` — the three museum floors
- `game/src/render.js` — all drawing: floor, cones, walls, crates, bushes, HUD
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — procedural WebAudio sound, no audio files
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|play|alert|win`)
- `game/src/config.js` — every tuning number and colour
- `main.ts` — the make.fun hand-in program (Node 22)

## License

MIT. See [LICENSE](LICENSE).
