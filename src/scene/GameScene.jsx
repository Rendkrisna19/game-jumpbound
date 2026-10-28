import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { useGame, isPlaying } from '../game/store';
import { gameClock, MAX_DT } from '../game/clock';
import { playerState } from '../game/playerState';
import { SkyDome, Lighting, Floor, Clouds, Scenery } from './environment/Atmosphere';
import Platforms from './environment/Platforms';
import Decorations from './environment/Decorations';
import Player from './player/Player';
import CameraRig from './player/CameraRig';
import { Crystals, Sunstones, Checkpoints } from './entities/Collectibles';
import Enemies from './entities/Enemies';
import Hazards from './entities/Hazards';
import Portal from './entities/Portal';
import Effects from './entities/Effects';

/** Advances the gameplay clock only while the game is actually running. Mounted first. */
function ClockDriver() {
  useFrame((_, delta) => {
    if (!isPlaying()) {
      gameClock.delta = 0;
      return;
    }
    const dt = Math.min(delta, MAX_DT);
    gameClock.delta = dt;
    gameClock.time += dt;
    if (!playerState.celebrating) gameClock.levelTime += dt;
  });
  return null;
}

export function levelCenter(level) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of level.platforms) {
    minX = Math.min(minX, p.pos[0]);
    maxX = Math.max(maxX, p.pos[0]);
    minZ = Math.min(minZ, p.pos[2]);
    maxZ = Math.max(maxZ, p.pos[2]);
  }
  return [(minX + maxX) / 2, 0, (minZ + maxZ) / 2];
}

export default function GameScene({ level, quality }) {
  const screen = useGame((s) => s.screen);
  const theme = level.theme;
  const center = useMemo(() => levelCenter(level), [level]);

  return (
    <>
      <ClockDriver />
      <SkyDome theme={theme} />
      <fog attach="fog" args={[theme.fog.color, theme.fog.near, theme.fog.far]} />
      <Lighting theme={theme} quality={quality} />
      <Floor theme={theme} center={center} />
      <Clouds theme={theme} center={center} count={quality === 'low' ? 7 : 14} />
      <Scenery theme={theme} center={center} palette={theme.palette} />

      <Physics timeStep="vary" paused={screen !== 'playing'} gravity={[0, 0, 0]} interpolate={false}>
        <Platforms level={level} />
        <Decorations level={level} quality={quality} />
        <Hazards level={level} />
        <Player level={level} />
        <CameraRig level={level} />
      </Physics>

      <Crystals level={level} />
      <Sunstones level={level} />
      <Checkpoints level={level} />
      <Enemies level={level} />
      <Portal level={level} />
      <Effects />
    </>
  );
}
