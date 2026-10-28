import { line, arc, ring, at } from './helpers.js';

// LEVEL 1 — SUNNY MEADOW
// Tutorial stage: short gaps, a single Forest Wanderer, a bounce cap and two checkpoints.
// Platform `pos` is always the centre of the walkable top surface.

export default {
  id: 'sunny-meadow',
  name: 'Sunny Meadow',
  subtitle: 'Island I',
  objective: 'Reach the Glimmer Portal',
  parTime: 120,
  cameraYaw: 0,
  killY: -14,
  spawn: [0, 0, 2.5],
  theme: {
    key: 'meadow',
    music: 'meadow',
    sky: { top: '#2f86e0', horizon: '#bfe8ff', bottom: '#f4fbff', sun: '#fff4c9' },
    fog: { color: '#c8e8fb', near: 55, far: 190 },
    light: {
      sun: '#fff0d4', sunIntensity: 2.6, sunDir: [0.55, 1, 0.35],
      hemiSky: '#d6ecff', hemiGround: '#5f8f45', hemiIntensity: 1.0,
    },
    floor: { type: 'sea', color: '#36c4c4', deep: '#1b8fa6', y: -26 },
    palette: {
      top: '#63cf4f', topDark: '#49b347', side: '#a06b3f', rock: '#8c7b6c',
      wood: '#c08048', woodDark: '#8a5430', trim: '#ffd25a', accent: '#ff9b3d',
    },
  },
  platforms: [
    { id: 'start', type: 'island', pos: [0, 0, 0], radius: 6, decor: { tree: 3, flower: 16, grass: 14, rock: 2 } },
    { id: 'a', type: 'island', pos: [0, 0, -13], radius: 4.5, decor: { tree: 1, flower: 8, grass: 8, rock: 1 } },
    { id: 'step', type: 'block', pos: [0, 0.9, -20.5], size: [3, 1.6, 3], decor: { grass: 3 } },
    { id: 'b', type: 'island', pos: [0, 1.6, -29], radius: 5.5, decor: { tree: 2, flower: 10, grass: 10, mushroom: 3 } },
    { id: 'side1', type: 'island', pos: [-9.5, 3.0, -29], radius: 1.6, decor: { grass: 3, flower: 2 } },
    { id: 'side2', type: 'island', pos: [-13.5, 4.4, -31], radius: 1.4, decor: { flower: 3 } },
    { id: 'bridge1', type: 'bridge', pos: [0, 1.6, -38.5], size: [2.4, 0.35, 8.6] },
    { id: 'c', type: 'island', pos: [0, 1.6, -48], radius: 5.5, decor: { tree: 2, flower: 12, grass: 10, rock: 1 } },
    { id: 'cap', type: 'mushroom', pos: [-3.2, 2.3, -51.5], radius: 1.2, bounce: 17 },
    { id: 'ledge', type: 'island', pos: [-8.2, 6.2, -55.5], radius: 2, decor: { flower: 4, grass: 3 } },
    { id: 's1', type: 'island', pos: [2, 2.4, -57], radius: 1.6, decor: { grass: 2 } },
    { id: 's2', type: 'island', pos: [5, 3.2, -61.5], radius: 1.5, decor: { flower: 2 } },
    { id: 's3', type: 'island', pos: [2, 4.0, -66], radius: 1.5, decor: { grass: 2 } },
    { id: 'd', type: 'island', pos: [0, 4.0, -75], radius: 5.5, decor: { tree: 2, flower: 10, grass: 10, mushroom: 2 } },
    { id: 'pillar', type: 'pillar', pos: [7.5, 6.0, -78], radius: 1.2, depth: 9 },
    { id: 'goal', type: 'island', pos: [0, 4.6, -89], radius: 6, decor: { tree: 3, flower: 16, grass: 12, rock: 2 } },
  ],
  // Every listed route is checked by tests/levels.test.js against the player's jump envelope.
  routes: [
    ['start', 'a', 'step', 'b', 'bridge1', 'c', 's1', 's2', 's3', 'd', 'goal'],
    ['b', 'side1', 'side2', 'side1', 'b'],
    ['c', 'cap', 'ledge', 'c'],
    ['d', 'pillar', 'd'],
  ],
  checkpoints: [
    { pos: [2.6, 1.6, -45.6] },
    { pos: [2.6, 4.0, -72.2] },
  ],
  portal: { pos: [0, 4.6, -92.5] },
  enemies: [
    { type: 'wanderer', from: [-3.2, 1.6, -28.2], to: [3.2, 1.6, -28.2], speed: 1.6 },
  ],
  hazards: [
    { type: 'spikes', pos: [2.7, 0, -13.6], size: [1.5, 1.5] },
    { type: 'spikes', pos: [-2.8, 4.0, -77.2], size: [2, 1.3] },
  ],
  hints: [
    { pos: [0, 0, -1], radius: 4.5, text: 'WASD / Arrows to move · SPACE to jump', once: true },
    { pos: [0, 1.6, -25.5], radius: 3.5, text: 'Jump on Forest Wanderers to defeat them!' },
    { pos: [-3.2, 1.6, -49.5], radius: 2.6, text: 'Glowcaps bounce you up to high ledges' },
  ],
  crystals: [
    ...line([0, 0, -1.5], [0, 0, -4.5], 3),
    ...arc([0, 0, -5.6], [0, 0, -8.6], 3, 1.1),
    ...line([0, 0, -10], [0, 0, -16], 3),
    ...arc([0, 0, -17.6], [0, 0.9, -19.4], 1, 1),
    at([0, 0.9, -20.5]),
    ...arc([0, 0.9, -22], [0, 1.6, -23.6], 1, 1),
    ...ring([0, 1.6, -29], 2.4, 6, Math.PI / 6),
    ...arc([-5.6, 1.6, -29], [-8, 3.0, -29], 2, 1.1),
    at([-9.5, 3.0, -29]),
    ...line([0, 1.6, -35.5], [0, 1.6, -41.5], 4),
    ...line([-1.2, 1.6, -44], [-1.2, 1.6, -50], 3),
    ...ring([-8.2, 6.2, -55.5], 1.1, 5),
    ...arc([1, 1.6, -53.2], [1.8, 2.4, -55.6], 1, 1),
    at([2, 2.4, -57]),
    ...arc([3, 2.4, -58.5], [4.2, 3.2, -60.3], 1, 1),
    at([5, 3.2, -61.5]),
    ...arc([4.2, 3.2, -62.8], [2.8, 4, -64.8], 1, 1),
    at([2, 4.0, -66]),
    ...arc([1.7, 4, -67.5], [0.6, 4, -69.4], 1, 1),
    ...line([0, 4.0, -71], [0, 4.0, -79], 3),
    ...arc([0, 4, -80.8], [0, 4.6, -83.2], 2, 1.1),
    ...line([0, 4.6, -85], [0, 4.6, -89], 3),
  ],
  sunstones: [
    at([-13.5, 4.4, -31], 0.3),
    at([-8.2, 6.2, -55.5], 0.4),
    at([7.5, 6.0, -78], 0.3),
  ],
};
