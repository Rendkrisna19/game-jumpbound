# Asset Credits — JUMPBOUND: The Lost Island

This project avoids third-party art and audio files on purpose. Everything the player sees and
hears is **generated at runtime by code in this repository**, and nothing is loaded from a remote URL.

## Third-party assets

| Asset | Used for | Source | Author | License | Attribution required? |
|---|---|---|---|---|---|
| **Fredoka** typeface (weights 400/600/700) | All UI text | npm package [`@fontsource/fredoka`](https://fontsource.org/fonts/fredoka) (upstream: https://github.com/hafontia/Fredoka-One) | The Fredoka Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org/) | No attribution is needed in the UI. The license text must stay with redistributed font files (it ships in `node_modules/@fontsource/fredoka/LICENSE`). The font must not be sold on its own. |

The font files are bundled into `dist/assets/` at build time. They are never fetched from a CDN.

## Original assets (created for this project)

| Asset | How it is made | Location |
|---|---|---|
| Heroes Wren, Kiko and Mira | Built from Three.js primitives and animated in code; SVG portraits drawn in code | `src/scene/player/PlayerModel.jsx`, `src/game/characters.js`, `src/ui/CharacterSelect.jsx` |
| Forest Wanderer and Crystal Guardian enemies | Primitives with procedural animation | `src/scene/entities/Enemies.jsx` |
| Floating islands, mesas, bridges, pillars, platforms | Procedural low-poly geometry with seeded vertex jitter | `src/scene/geometry.js`, `src/scene/environment/Platforms.jsx` |
| Trees, flowers, grass, rocks, mushrooms, crystal clusters, columns, lanterns | Instanced primitives, scattered with a seeded RNG | `src/scene/environment/Decorations.jsx` |
| Sky gradient, sea, clouds, distant scenery | GLSL gradient shader plus animated low-poly meshes | `src/scene/environment/Atmosphere.jsx` |
| Portal swirl texture | Drawn into an HTML canvas at runtime | `src/scene/entities/Portal.jsx` |
| All sound effects | Synthesised live with the Web Audio API (oscillators plus filtered noise) | `src/audio/AudioManager.js` |
| Background music (4 loops) | Original procedural compositions generated from fixed seeds, played by a Web Audio sequencer | `src/audio/AudioManager.js` |
| Favicon | Hand-written SVG | `public/favicon.svg` |

These original assets belong to this project and are released under the same license as the
game's source code.

## Third-party code libraries

These are runtime dependencies, not art assets. Each keeps its own license.

| Library | License |
|---|---|
| React, React DOM | MIT |
| three.js | MIT |
| @react-three/fiber, @react-three/drei, @react-three/rapier | MIT |
| Rapier (`@dimforge/rapier3d-compat`) | Apache-2.0 |
| Zustand | MIT |
| Lucide React (icons) | ISC |
| Vite, @vitejs/plugin-react | MIT |

## Adding assets later

The resources recommended in the brief are good places to look for replacements (for example a
rigged GLB for Wren):

- Kenney: https://kenney.nl/assets (CC0)
- Quaternius: https://quaternius.com/ (CC0)
- Poly Haven: https://polyhaven.com/ (CC0)
- OpenGameArt: https://opengameart.org/ (licenses vary, so check each asset)

For each asset you add, do the following:

1. Download it into `public/assets/` so it is served locally.
2. Add a row to the *Third-party assets* table above with the source URL, author, license and attribution terms.
3. Credit the author in the in-game Credits panel (`src/ui/Panels.jsx`) whenever the license requires it.
