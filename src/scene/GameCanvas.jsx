import { Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import GameScene from './GameScene';
import MenuScene from './MenuScene';

export const perf = { fps: 60 };

/** Lightweight FPS probe (reads frame deltas; no extra draw calls). */
function FpsProbe() {
  useFrame((_, delta) => {
    if (delta > 0) perf.fps += (1 / delta - perf.fps) * 0.05;
  });
  return null;
}

const DPR = { low: [0.75, 1], medium: [1, 1.5], high: [1, 2] };

export default function GameCanvas() {
  const screen = useGame((s) => s.screen);
  const levelIndex = useGame((s) => s.levelIndex);
  const runId = useGame((s) => s.runId);
  const quality = useGame((s) => s.settings.quality);
  // Antialiasing is a context-creation flag: read once (applies after a reload).
  const [antialias] = useState(() => useGame.getState().settings.quality !== 'low');

  return (
    <Canvas
      className="game-canvas"
      shadows="percentage"
      dpr={DPR[quality]}
      gl={{ antialias, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 900, position: [0, 6, 14] }}
    >
      <FpsProbe />
      <Suspense fallback={null}>
        {screen === 'menu' ? (
          <MenuScene quality={quality} />
        ) : (
          <GameScene key={`${levelIndex}-${runId}`} level={LEVELS[levelIndex]} quality={quality} />
        )}
      </Suspense>
    </Canvas>
  );
}
