import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { crystalGeometry } from '../geometry';
import { getMaterial, getBasicMaterial } from '../materials';
import { playerState } from '../../game/playerState';
import { capsuleSphere } from '../../game/math/collision';
import { gameClock } from '../../game/clock';
import { getGame, isPlaying, session, useGame } from '../../game/store';
import { spawnBurst } from '../../game/effects';
import { audio } from '../../audio/AudioManager';

const CRYSTAL_COLORS = ['#b46bff', '#7fd8ff', '#ff7ad9'];
const PICKUP_RADIUS = 0.45;
const POP_TIME = 0.28;

/**
 * All crystals of a level in a single InstancedMesh. Collected crystals are tracked in the
 * session Set, so a crystal can never be counted twice (even across respawns).
 */
export function Crystals({ level }) {
  const items = level.crystals;
  const mesh = useMemo(() => {
    const m = new InstancedMesh(
      crystalGeometry(),
      getMaterial('#ffffff', { roughness: 0.2, metalness: 0.1, emissive: '#6a3cff', emissiveIntensity: 0.55 }),
      items.length,
    );
    const c = new Color();
    items.forEach((_, i) => m.setColorAt(i, c.set(CRYSTAL_COLORS[i % CRYSTAL_COLORS.length])));
    m.frustumCulled = false;
    m.castShadow = false;
    return m;
  }, [items]);
  useEffect(() => () => mesh.dispose(), [mesh]);

  const popAt = useMemo(() => items.map((_, i) => (session.collected.has(`c${i}`) ? -100 : null)), [items]);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const t = gameClock.time;
    const playing = isPlaying() && !playerState.dead;
    const cap = playerState.capsule;
    for (let i = 0; i < items.length; i++) {
      const [x, y, z] = items[i];
      const pop = popAt[i];
      if (pop !== null) {
        const k = (t - pop) / POP_TIME;
        if (k >= 1) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.set(x, y + k * 0.8, z);
          dummy.scale.setScalar(1 + k * 0.8 - k * k * 1.8);
          dummy.rotation.set(0, t * 12, 0);
        }
      } else {
        const by = y + Math.sin(t * 2.4 + i * 0.9) * 0.12;
        dummy.position.set(x, by, z);
        dummy.rotation.set(0, t * 2.2 + i * 0.7, 0);
        dummy.scale.setScalar(1);
        if (playing && capsuleSphere(cap, x, by, z, PICKUP_RADIUS)) {
          if (getGame().collectCrystal(`c${i}`)) {
            popAt[i] = t;
            audio.play('collect');
            spawnBurst([x, by, z], { color: CRYSTAL_COLORS[i % CRYSTAL_COLORS.length], count: 8, speed: 2.6, up: 1.5, size: 0.1, life: 0.5 });
          }
        }
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}

function Sunstone({ id, pos }) {
  const group = useRef(null);
  const ring = useRef(null);
  const state = useRef({ collectedAt: session.sunstones.has(id) ? -100 : null });

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = gameClock.time;
    const s = state.current;
    if (s.collectedAt !== null) {
      const k = (t - s.collectedAt) / 0.5;
      g.visible = k < 1;
      g.scale.setScalar(1 + k * 1.5);
      g.position.y = pos[1] + k * 1.5;
      return;
    }
    g.position.y = pos[1] + Math.sin(t * 1.8) * 0.18;
    g.rotation.y = t * 1.4;
    if (ring.current) ring.current.rotation.x = t * 2.2;
    if (isPlaying() && !playerState.dead && capsuleSphere(playerState.capsule, pos[0], g.position.y, pos[2], 0.6)) {
      if (getGame().collectSunstone(id)) {
        s.collectedAt = t;
        audio.play('sunstone');
        spawnBurst([pos[0], g.position.y, pos[2]], { color: '#ffd45a', count: 26, speed: 4.5, up: 2.5, size: 0.14 });
      }
    }
  });

  return (
    <group ref={group} position={pos}>
      <mesh material={getMaterial('#ffcf3a', { roughness: 0.25, metalness: 0.4, emissive: '#ff9d00', emissiveIntensity: 0.9 })}>
        <dodecahedronGeometry args={[0.36, 0]} />
      </mesh>
      <group ref={ring}>
        <mesh material={getMaterial('#fff2b0', { emissive: '#ffd45a', emissiveIntensity: 1.2 })}>
          <torusGeometry args={[0.6, 0.04, 6, 24]} />
        </mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          rotation={[0, 0, (i / 6) * Math.PI * 2]}
          position={[Math.sin((i / 6) * Math.PI * 2) * -0.62, Math.cos((i / 6) * Math.PI * 2) * 0.62, 0]}
          material={getMaterial('#ffe48a', { emissive: '#ffbf2e', emissiveIntensity: 1 })}
        >
          <coneGeometry args={[0.07, 0.24, 4]} />
        </mesh>
      ))}
      <mesh material={getBasicMaterial('#ffe9a0', { transparent: true, opacity: 0.22, depthWrite: false })}>
        <sphereGeometry args={[0.85, 14, 10]} />
      </mesh>
    </group>
  );
}

export function Sunstones({ level }) {
  return level.sunstones.map((pos, i) => <Sunstone key={i} id={`s${i}`} pos={pos} />);
}

// ---------------------------------------------------------------- checkpoints ("Wayshrines")
function Checkpoint({ index, pos, accent }) {
  const active = useGame((s) => s.checkpointIndex >= index);
  const gem = useRef(null);
  const ring = useRef(null);
  const flag = useRef(null);
  const activatedAt = useRef(-10);

  useFrame(() => {
    const t = gameClock.time;
    if (gem.current) {
      gem.current.rotation.y = t * (active ? 2.4 : 0.6);
      gem.current.position.y = 1.55 + (active ? Math.sin(t * 3) * 0.1 + 0.15 : 0);
    }
    if (flag.current) flag.current.rotation.y = active ? Math.sin(t * 4) * 0.25 : 0;
    if (ring.current) {
      const k = (t - activatedAt.current) / 0.8;
      ring.current.visible = k >= 0 && k < 1;
      if (ring.current.visible) {
        ring.current.scale.setScalar(0.5 + k * 3.5);
        ring.current.material.opacity = 1 - k;
      }
    }
    if (!active && isPlaying() && !playerState.dead) {
      const c = playerState.capsule;
      if (Math.hypot(c.x - pos[0], c.z - pos[2]) < 1.35 && c.y > pos[1] - 0.5 && c.y < pos[1] + 3.5) {
        if (getGame().activateCheckpoint(index, pos)) {
          activatedAt.current = t;
          audio.play('checkpoint');
          spawnBurst([pos[0], pos[1] + 1.6, pos[2]], { color: '#8dffb0', count: 22, speed: 3.5, up: 3 });
        }
      }
    }
  });

  const gemMat = active
    ? getMaterial('#7dffb2', { roughness: 0.2, emissive: '#2bd47a', emissiveIntensity: 1.1 })
    : getMaterial('#9aa6b8', { roughness: 0.4, emissive: '#223', emissiveIntensity: 0.2 });

  return (
    <group position={pos}>
      <mesh position={[0, 0.12, 0]} material={getMaterial('#b9b2a6')} receiveShadow castShadow>
        <cylinderGeometry args={[0.65, 0.75, 0.24, 8]} />
      </mesh>
      <mesh position={[0, 0.65, 0]} material={getMaterial('#d8d0c2')} castShadow>
        <boxGeometry args={[0.28, 0.9, 0.28]} />
      </mesh>
      <mesh position={[0, 1.12, 0]} material={getMaterial('#ffd25a', { roughness: 0.35, metalness: 0.5 })}>
        <cylinderGeometry args={[0.28, 0.2, 0.12, 8]} />
      </mesh>
      <mesh ref={gem} position={[0, 1.55, 0]} material={gemMat}>
        <octahedronGeometry args={[0.3, 0]} />
      </mesh>
      <group ref={flag} position={[0.16, 1.0, 0]}>
        <mesh position={[0, 0.25, 0]} material={getMaterial('#6b4a2e')}>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 5]} />
        </mesh>
        <mesh position={[0.3, 0.72, 0]} material={getMaterial(active ? accent : '#8b8f99', { flat: true })}>
          <boxGeometry args={[0.55, 0.32, 0.03]} />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color="#9dffc4" transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Checkpoints({ level }) {
  return level.checkpoints.map((c, i) => <Checkpoint key={i} index={i} pos={c.pos} accent={level.theme.palette.accent} />);
}
