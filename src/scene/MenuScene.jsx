import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import level1 from '../game/levels/level1';
import { ring } from '../game/levels/helpers';
import { gameClock } from '../game/clock';
import { SkyDome, Lighting, Floor, Clouds, Scenery } from './environment/Atmosphere';
import Platforms from './environment/Platforms';
import Decorations from './environment/Decorations';
import { Crystals } from './entities/Collectibles';
import Portal from './entities/Portal';
import PlayerModel from './player/PlayerModel';

// A small diorama of the Sunny Meadow used as the animated main-menu background.
const MENU_LEVEL = {
  id: 'menu-diorama',
  theme: level1.theme,
  spawn: [2.2, 0, 2.6],
  platforms: [
    { id: 'main', type: 'island', pos: [0, 0, 0], radius: 7, decor: { tree: 4, flower: 22, grass: 18, rock: 3, mushroom: 4 } },
    { id: 'east', type: 'island', pos: [12, 2.6, -5], radius: 3, decor: { tree: 1, flower: 6, grass: 5 } },
    { id: 'west', type: 'island', pos: [-11.5, 1.4, -7], radius: 3.6, decor: { tree: 2, flower: 6, grass: 6 } },
    { id: 'north', type: 'island', pos: [1, 4.5, -16], radius: 4, decor: { tree: 2, flower: 8, grass: 6, mushroom: 2 } },
    { id: 'cap', type: 'mushroom', pos: [-4.2, 0.7, 2.6], radius: 1.1, bounce: 17 },
  ],
  routes: [['main', 'east'], ['main', 'west'], ['main', 'north']],
  crystals: [...ring([0, 0.4, 0], 4.2, 9), ...ring([12, 2.6, -5], 1.4, 4), ...ring([-11.5, 1.4, -7], 1.6, 4)],
  sunstones: [],
  checkpoints: [],
  hazards: [],
  enemies: [],
  portal: { pos: [0, 0, -3.6] },
};

function MenuDriver() {
  useFrame((state, delta) => {
    gameClock.time += Math.min(delta, 0.05);
    const t = state.clock.elapsedTime * 0.07;
    const r = 17;
    state.camera.position.set(Math.sin(t) * r, 6.5 + Math.sin(t * 2) * 0.8, Math.cos(t) * r);
    state.camera.lookAt(0, 1.8, -2);
  });
  return null;
}

export default function MenuScene({ quality }) {
  const theme = MENU_LEVEL.theme;
  const center = useMemo(() => [0, 0, -4], []);
  return (
    <>
      <MenuDriver />
      <SkyDome theme={theme} />
      <fog attach="fog" args={[theme.fog.color, 40, 160]} />
      <Lighting theme={theme} quality={quality} follow={false} />
      <Floor theme={theme} center={center} />
      <Clouds theme={theme} center={center} count={quality === 'low' ? 6 : 10} spread={80} />
      <Scenery theme={theme} center={center} palette={theme.palette} />
      <Physics paused gravity={[0, 0, 0]}>
        <Platforms level={MENU_LEVEL} />
        <Decorations level={MENU_LEVEL} quality={quality} />
      </Physics>
      <Crystals level={MENU_LEVEL} />
      <Portal level={MENU_LEVEL} />
      <group position={[2.2, 0.8, 2.6]} rotation={[0, 0.5, 0]}>
        <PlayerModel mode="menu" />
      </group>
    </>
  );
}
