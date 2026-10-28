# JUMPBOUND: The Lost Island

A colorful third-person 3D platformer that runs in the browser. You play **Wren**, a small sky
explorer, across three floating islands. Along the way you jump gaps, ride moving platforms, stomp
enemies and collect crystals on the way to the portal at the end of each island.

The characters, worlds, sounds and music are original. They are generated procedurally in code,
so the game ships with no third-party art or audio files (see [ASSET_CREDITS.md](ASSET_CREDITS.md)).

## Quick start

Requires **Node.js 18+** (developed on Node 22) and npm.

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Unit tests: collision math, plus validation that every level is completable |
| `npm run smoke` | End-to-end test in headless Chrome/Edge against `dist/` (run `npm run build` first) |

The smoke test uses `puppeteer-core` with a browser that is already installed. It looks for Chrome
or Edge in the usual places, or you can set `BROWSER=/path/to/chrome`. It plays through the main
gameplay loop and saves screenshots to `scripts/.shots/`.

## Controls

| Input | Action |
|---|---|
| **W A S D** / **Arrow keys** | Move (relative to the camera) |
| **Space** | Jump. Hold it for a higher jump |
| **Shift** | Sprint |
| **Mouse drag** / **Q E** | Orbit the camera |
| **Mouse wheel** | Zoom |
| **Esc** / **P** | Pause or resume (also closes open panels) |
| **R** | Return to the last checkpoint |
| Touch | On-screen joystick plus Jump and Run buttons. Drag the screen to orbit the camera |

On touch devices the on-screen controls appear automatically. You can force them on or off in Settings.

## Gameplay

- **Three heroes**: *Wren* the Sky Explorer (aviator cap and goggles), *Kiko* the Fox Ranger (fox-ear hood) and *Mira* the Star Weaver (glowing star hat).
  - On a fresh save, **Play** opens the hero picker first.
  - You can switch hero at any time with the **Hero** button on the main menu. Your choice is saved.
  - All three move and jump identically, so the choice is purely visual.

- **Three islands**:
  - *Sunny Meadow*: the tutorial island.
  - *Crystal Canyon*: narrow bridges, moving platforms, a climbing section, a sprint gap and the first Crystal Guardian.
  - *Sky Temple*: an easy opening (two solid stepping stones around one slow-fading tile), then vanishing tiles, spinning beams, pulsing spikes, three guardians and a final ascent to the Sun Gate.
- **Movement**: camera-relative, with acceleration and deceleration, sprinting and variable jump height. It also has coyote time (0.12 s), jump buffering (0.14 s) and only one jump per take-off.
- **Health and lives**: 3 hearts and 3 lives. Losing every heart, or falling into the void, costs one life. Losing all lives shows the Game Over screen.
- **Checkpoints (Wayshrines)**: touch one to set where you respawn. You get 2.2 s of invulnerability after respawning, and 1.4 s after taking damage.
- **Collectible rule**: crystals, Sunstones and defeated enemies **stay** collected or defeated after you lose a life. Restarting the level or getting a Game Over resets them.
- **Scoring**:
  - Crystals ×10, Sunstones ×250, Forest Wanderer 50, Crystal Guardian 150.
  - Bonuses: completion 1000, time under par, lives left, and 500 for collecting every crystal.
  - Stars: 1 for finishing, +1 for at least 75% of crystals, +1 for every Sunstone.
- **Enemies**:
  - *Forest Wanderer* patrols back and forth. Stomp it to defeat it; touching its side hurts.
  - *Crystal Guardian* guards an area. It flashes red as a warning, dashes at where you were standing, then rests dazed. You can only stomp it while it rests.
- **Hazards**: spike patches, pulsing spike traps with a warning tremble, rotating sweeper beams, and the void.
- **Progression**: finishing an island unlocks the next one. Unlocked islands and best score, time and stars are saved in `localStorage`.

## Architecture

```
src/
  main.jsx                   entry point (fonts, styles, React root)
  App.jsx                    WebGL check, keyboard/visibility handling, audio director, debug hook
  game/                      engine-agnostic game logic (no React)
    constants.js             player physics tunables, scoring, jump envelope math
    store.js                 zustand store: screens, run state, scoring, progression actions
    persistence.js           localStorage for settings and progress
    characters.js            the three selectable heroes (colours and hat style)
    input.js                 keyboard and touch input state (read inside the render loop)
    playerState.js           shared mutable player data plus the imperative player API
    clock.js                 pausable gameplay clock
    registry.js              collider handle -> surface info (moving platform deltas, bounce pads)
    effects.js               particle request queue
    math/collision.js        analytic capsule vs sphere / AABB / cylinder / segment tests
    math/random.js           seeded RNG
    levels/                  level configs (pure data), helpers, geometry and validator
  scene/                     React Three Fiber scene
    GameCanvas.jsx           <Canvas>, quality presets (DPR), menu/game switch
    GameScene.jsx            one level: atmosphere, <Physics>, entities
    MenuScene.jsx            animated diorama behind the main menu
    materials.js, geometry.js  shared or cached materials and procedural geometry
    environment/             Atmosphere (sky, lights, sea, clouds, scenery), Platforms, Decorations
    player/                  Player (controller), PlayerModel (procedural heroes), CameraRig
    entities/                Collectibles (crystals, sunstones, checkpoints), Enemies, Hazards, Portal, Effects
  audio/AudioManager.js      Web Audio synthesiser: SFX and a procedural music sequencer
  ui/                        HTML overlays: MainMenu, CharacterSelect, HUD, Screens (pause, victory, game over), Panels, TouchControls
tests/                       node:test unit tests
scripts/smoke-test.mjs       headless browser end-to-end test
```

### Key design decisions

- **Physics.** The player is a Rapier **kinematic character controller** (`world.createCharacterController`) with a capsule collider. It handles platform collision, slopes, autostep and snap-to-ground, and reports when the player is grounded. Gravity, jumping and air control are integrated by hand, which keeps the movement tunable and predictable.
  - Moving platforms are kinematic bodies. They publish their delta for each frame through `registry.js`, and the player adds it while standing on them.
  - Vanishing tiles turn their body on and off with `setEnabled`.
  - A downward raycast identifies the surface under the player (moving platform or bounce pad).
- **Triggers and contacts.** Enemies, hazards, pickups, checkpoints and the portal use exact **analytic shape tests** against the player capsule (`math/collision.js`, unit tested). They don't need extra physics bodies.
- **No per-frame React renders.** High-frequency data (positions, velocities, timers) lives in plain mutable objects and refs. The zustand store changes only on discrete events such as collecting an item, taking damage or changing screen. The HUD timer and progress bar update the DOM directly on an interval.
- **Pause.** Gameplay systems advance only on the pausable `gameClock`, and `<Physics paused>` stops the world. So pausing freezes the player, enemies, platforms, hazards, timers and particles.
- **Data-driven levels.**
  - A level is a plain object listing platforms (`island`, `block`, `bridge`, `pillar`, `mushroom`, `mover`, `timed`), collectibles, enemies, hazards, checkpoints, hints, theme colors and `routes`.
  - To add a stage, create `src/game/levels/levelN.js` and append it to `levels/index.js`.
  - `npm test` runs `validateLevel()`. It checks that every jump along each route fits inside the player's real jump envelope, which is derived from the constants with a 20% safety margin. It also checks that checkpoints, enemies, hazards and the portal sit on solid ground, and that every collectible is reachable and not buried in geometry.
- **Performance.**
  - Crystals, decorations, clouds and particles use `InstancedMesh`.
  - Materials and geometries are shared from caches.
  - Only one shadow-casting light is used, and its frustum follows the player.
  - DPR is capped per quality preset (Low 1.0, Medium 1.5, High 2.0). Low also disables shadows and halves the small decorations.
- **Swappable hero.** `Player.jsx` only positions a group. To use a licensed rigged GLB for Wren, replace `PlayerModel.jsx`, which reads `playerState` to pick an animation.

## Settings

Settings are saved to `localStorage`:

- Master, music and sound-effect volume
- Graphics quality (Low / Medium / High)
- FPS counter
- Mouse sensitivity and inverted vertical look
- Camera shake
- Touch controls (Auto / On / Off)
- Reset progress (available from the main menu's Settings)

## Known limitations

- Anti-aliasing is set when the WebGL context is created. Switching to or from *Low* quality changes it only after a page reload; shadows, DPR and decoration density update immediately.
- The camera avoids terrain by raycasting against static level geometry. It does not avoid moving platforms or thin decorations.
- Music is a simple procedural loop rather than a composed soundtrack.
- The hero is built from primitives. It is designed to be swapped for a rigged model, but no GLB is bundled.
- The Rapier WASM bundle is large (about 2.2 MB, 840 kB gzipped). It loads once at startup.
