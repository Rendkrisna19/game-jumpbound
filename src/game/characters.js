// Selectable heroes. All of them share the same controller and collision capsule, so the choice
// is purely visual (fair for every level). Colours and headwear feed the procedural model in
// PlayerModel.jsx, and the same palette is used for the portraits in CharacterSelect.jsx.

export const CHARACTERS = [
  {
    id: 'wren',
    name: 'Wren',
    title: 'Sky Explorer',
    description: 'A curious aviator with trusty goggles and a violet plume.',
    hat: 'aviator',
    colors: {
      skin: '#ffd1a6', hair: '#6b3f22', tunic: '#22b3a2', tunicDark: '#178a80', pants: '#355c9e', boot: '#7a4a2b',
      hat: '#ffc63d', hatDark: '#e59f22', accent: '#9b5cff', scarf: '#ff7a3d', pack: '#a8693a', roll: '#d8483f',
    },
  },
  {
    id: 'kiko',
    name: 'Kiko',
    title: 'Fox Ranger',
    description: 'A quick-footed forest scout in a cosy fox-ear hood.',
    hat: 'fox',
    colors: {
      skin: '#f6c49a', hair: '#3a2a1e', tunic: '#5fae3e', tunicDark: '#3f8a2c', pants: '#6b4a2e', boot: '#3b2a1f',
      hat: '#ff8a3d', hatDark: '#d9601a', accent: '#fff4e0', scarf: '#fff4e0', pack: '#8a5a34', roll: '#3f7fd6',
    },
  },
  {
    id: 'mira',
    name: 'Mira',
    title: 'Star Weaver',
    description: 'An apprentice star-mage whose tall hat glows with a tiny star.',
    hat: 'star',
    colors: {
      skin: '#c98e6a', hair: '#2b1c3a', tunic: '#ff7ab6', tunicDark: '#d9538f', pants: '#3b3570', boot: '#2b2450',
      hat: '#3f5bd9', hatDark: '#2b3f9e', accent: '#ffe066', scarf: '#5fe0c0', pack: '#7a5aa8', roll: '#ffd25a',
    },
  },
  {
    id: 'pip',
    name: 'Pip',
    title: 'Meadow Gardener',
    description: 'A cheerful gardener with a leafy sprout hat and a sunny yellow scarf.',
    hat: 'sprout',
    colors: {
      skin: '#ffdcb8', hair: '#8a4b1f', tunic: '#7ab648', tunicDark: '#5a8e33', pants: '#6b4a2e', boot: '#4a3020',
      hat: '#3fae4a', hatDark: '#2a8036', accent: '#ffd25a', scarf: '#ffd25a', pack: '#b07a4a', roll: '#e8a7c5',
    },
  },
  {
    id: 'nori',
    name: 'Nori',
    title: 'Tide Diver',
    description: 'A calm sea-explorer wearing a bubble helmet with a brass ring.',
    hat: 'diver',
    colors: {
      skin: '#f2c5a0', hair: '#1f4f7a', tunic: '#2e7bd6', tunicDark: '#1f5aa6', pants: '#2b3f66', boot: '#1f2d4a',
      hat: '#8fe3ff', hatDark: '#c9a24a', accent: '#c9a24a', scarf: '#ffffff', pack: '#4f6b7a', roll: '#ffb35c',
    },
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
