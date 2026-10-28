import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, DoubleSide, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { getMaterial } from '../materials';
import { playerState, playerApi, addCameraTrauma } from '../../game/playerState';
import { capsuleSphere } from '../../game/math/collision';
import { gameClock } from '../../game/clock';
import { isPlaying } from '../../game/store';
import { spawnBurst } from '../../game/effects';

/** Procedural swirl texture (generated once per colour pair). */
function makeSwirl(inner, outer) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const a = arm * ((Math.PI * 2) / 5) + t * 5.5;
      const r = t * size * 0.48;
      const x = size / 2 + Math.cos(a) * r;
      const y = size / 2 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export default function Portal({ level }) {
  const { pos, final } = level.portal;
  const center = useMemo(() => [pos[0], pos[1] + 1.9, pos[2]], [pos]);
  const disc = useRef(null);
  const ringRef = useRef(null);
  const orbiters = useRef(null);
  const triggered = useRef(false);

  const inner = final ? '#ffe9a6' : '#c9a6ff';
  const outer = final ? '#ff9d2e' : '#5b3cff';
  const texture = useMemo(() => makeSwirl(inner, outer), [inner, outer]);
  const discMat = useMemo(
    () => new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false }),
    [texture],
  );
  const beamMat = useMemo(
    () => new MeshBasicMaterial({ color: final ? '#ffd46b' : '#b48cff', transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    [final],
  );
  useEffect(
    () => () => {
      texture.dispose();
      discMat.dispose();
      beamMat.dispose();
    },
    [texture, discMat, beamMat],
  );

  const ringMat = getMaterial(final ? '#ffd25a' : '#9b6bff', { roughness: 0.3, metalness: 0.5, emissive: final ? '#ff9d00' : '#5a2fd0', emissiveIntensity: 0.7 });
  const stone = getMaterial(level.theme.palette.topDark);

  useFrame((_, delta) => {
    const t = gameClock.time;
    if (disc.current) disc.current.rotation.z = -t * 1.6;
    // The gate rumbles as the hero closes in: the closer, the stronger the shake.
    if (isPlaying() && !triggered.current && !playerState.dead) {
      const d = Math.hypot(playerState.position.x - center[0], playerState.position.z - center[2]);
      if (d < 14) addCameraTrauma(((14 - d) / 14) * 0.9 * Math.min(delta, 0.05) * 3);
    }
    if (ringRef.current && !triggered.current) {
      ringRef.current.position.x = Math.sin(t * 38) * 0.02 * Math.max(0, 1 - Math.abs(playerState.position.y - center[1]) / 6);
    }
    if (ringRef.current) {
      const pulse = triggered.current ? 1 + Math.sin(t * 12) * 0.06 + 0.12 : 1 + Math.sin(t * 2) * 0.03;
      ringRef.current.scale.setScalar(pulse);
    }
    if (orbiters.current) orbiters.current.rotation.z = t * 0.9;
    if (!triggered.current && isPlaying() && !playerState.dead) {
      if (capsuleSphere(playerState.capsule, center[0], center[1] - 0.6, center[2], 1.15)) {
        triggered.current = true;
        playerApi.reachPortal();
        spawnBurst(center, { color: final ? '#ffd45a' : '#c9a6ff', count: 40, speed: 6, up: 2, life: 1.1 });
      }
    }
  });

  return (
    <group>
      {/* guiding light beam visible from afar */}
      <mesh position={[center[0], center[1] + 14, center[2]]} material={beamMat}>
        <cylinderGeometry args={[0.9, 1.6, 30, 12, 1, true]} />
      </mesh>
      <group position={center}>
        <group ref={ringRef}>
          <mesh material={ringMat} castShadow>
            <torusGeometry args={[1.5, 0.2, 10, 36]} />
          </mesh>
          <mesh ref={disc} material={discMat}>
            <circleGeometry args={[1.38, 40]} />
          </mesh>
          <group ref={orbiters}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0]} material={getMaterial(inner, { emissive: inner, emissiveIntensity: 1 })}>
                  <octahedronGeometry args={[0.12, 0]} />
                </mesh>
              );
            })}
          </group>
        </group>
        {/* stone feet */}
        {[-1.35, 1.35].map((x) => (
          <mesh key={x} position={[x, -1.55, 0]} material={stone} castShadow>
            <boxGeometry args={[0.6, 0.7, 0.8]} />
          </mesh>
        ))}
        {final && (
          <>
            {[-2.3, 2.3].map((x) => (
              <group key={x} position={[x, -0.4, 0]}>
                <mesh material={getMaterial(level.theme.palette.top)} castShadow>
                  <cylinderGeometry args={[0.32, 0.36, 3.8, 12]} />
                </mesh>
                <mesh position={[0, 2, 0]} material={ringMat}>
                  <boxGeometry args={[0.85, 0.25, 0.85]} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 1.75, 0]} material={getMaterial(level.theme.palette.top)} castShadow>
              <boxGeometry args={[5.6, 0.4, 0.9]} />
            </mesh>
            <mesh position={[0, 2.5, 0.1]} material={ringMat}>
              <circleGeometry args={[0.6, 12]} />
            </mesh>
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.95, 2.5 + Math.sin(a) * 0.95, 0.1]} rotation={[0, 0, a - Math.PI / 2]} material={ringMat}>
                  <coneGeometry args={[0.1, 0.45, 4]} />
                </mesh>
              );
            })}
          </>
        )}
      </group>
    </group>
  );
}
