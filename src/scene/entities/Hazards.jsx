import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { getMaterial } from '../materials';
import { coneGeometry } from '../geometry';
import { playerState, playerApi } from '../../game/playerState';
import { capsuleAabb, capsuleSegment } from '../../game/math/collision';
import { gameClock } from '../../game/clock';
import { isPlaying } from '../../game/store';
import { audio } from '../../audio/AudioManager';

const SPIKE_H = 0.55;
const spikeMat = getMaterial('#e8e6f0', { roughness: 0.35, metalness: 0.4 });
const plateMat = getMaterial('#4a3b5c');
const warnMat = getMaterial('#ff5a3d', { emissive: '#ff2a00', emissiveIntensity: 0.6 });

function spikeGrid(w, d) {
  const out = [];
  const nx = Math.max(1, Math.round(w / 0.42));
  const nz = Math.max(1, Math.round(d / 0.42));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      out.push([-w / 2 + (w / nx) * (i + 0.5), -d / 2 + (d / nz) * (j + 0.5)]);
    }
  }
  return out;
}

function SpikeField({ w, d, spikesRef, warn }) {
  const grid = useMemo(() => spikeGrid(w, d), [w, d]);
  const geo = coneGeometry(0.17, SPIKE_H, 5);
  return (
    <>
      <mesh position={[0, 0.04, 0]} material={warn ? warnMat : plateMat} receiveShadow>
        <boxGeometry args={[w + 0.12, 0.08, d + 0.12]} />
      </mesh>
      <group ref={spikesRef}>
        {grid.map(([x, z], i) => (
          <mesh key={i} geometry={geo} material={spikeMat} position={[x, SPIKE_H / 2 + 0.06, z]} castShadow />
        ))}
      </group>
    </>
  );
}

/** Permanent spike patch. */
function Spikes({ h }) {
  const [w, d] = h.size;
  const [x, y, z] = h.pos;
  useFrame(() => {
    if (!isPlaying() || playerState.dead) return;
    if (capsuleAabb(playerState.capsule, x - w / 2, y, z - d / 2, x + w / 2, y + SPIKE_H, z + d / 2)) {
      playerApi.hurt({ x, z });
    }
  });
  return (
    <group position={h.pos}>
      <SpikeField w={w} d={d} warn />
    </group>
  );
}

/** Spikes that retract and extend on a timer, with a visible warning tremble. */
function PulseSpikes({ h }) {
  const [w, d] = h.size;
  const [x, y, z] = h.pos;
  const spikes = useRef(null);
  const wasUp = useRef(false);
  useFrame(() => {
    const period = h.period;
    const local = (((gameClock.time + (h.phase ?? 0)) % period) + period) % period;
    const upTime = period * 0.45;
    let height; // 0 = hidden, 1 = fully extended
    if (local < 0.12) height = local / 0.12;
    else if (local < upTime) height = 1;
    else if (local < upTime + 0.2) height = 1 - (local - upTime) / 0.2;
    else if (local > period - 0.6) height = 0.18 + Math.sin(gameClock.time * 50) * 0.04; // warning peek
    else height = 0;
    if (spikes.current) {
      spikes.current.position.y = -SPIKE_H * (1 - height);
      spikes.current.visible = height > 0.01;
    }
    const up = height > 0.5;
    if (up && !wasUp.current) {
      const dist = Math.hypot(playerState.position.x - x, playerState.position.z - z);
      if (dist < 10) audio.play('spikes', { volume: 1 - dist / 10 });
    }
    wasUp.current = up;
    if (!isPlaying() || playerState.dead || height < 0.45) return;
    if (capsuleAabb(playerState.capsule, x - w / 2, y, z - d / 2, x + w / 2, y + SPIKE_H * height, z + d / 2)) {
      playerApi.hurt({ x, z });
    }
  });
  return (
    <group position={h.pos}>
      <SpikeField w={w} d={d} spikesRef={spikes} warn />
    </group>
  );
}

/** A beam rotating around a central post. Jump over it! */
function Sweeper({ h }) {
  const arm = useRef(null);
  const [x, y, z] = h.pos;
  const L = h.length;
  const barY = y + h.height;
  const BAR_R = 0.2;
  useFrame(() => {
    const a = gameClock.time * h.speed;
    if (arm.current) arm.current.rotation.y = a;
    if (!isPlaying() || playerState.dead) return;
    // Bar endpoints (rotation about +Y maps local +X to (cos a, 0, -sin a)).
    const cx = Math.cos(a) * L;
    const cz = -Math.sin(a) * L;
    const cap = playerState.capsule;
    if (capsuleSegment(cap, x - cx, barY, z - cz, x + cx, barY, z + cz, BAR_R)) {
      // Knock the player along the beam's direction of travel.
      const px = cap.x - x;
      const pz = cap.z - z;
      const sign = Math.sign(h.speed) || 1;
      const tx = pz * sign;
      const tz = -px * sign;
      const tl = Math.hypot(tx, tz) || 1;
      playerApi.hurt({ x: cap.x - tx / tl, z: cap.z - tz / tl }, { force: 0.7 });
    }
  });
  return (
    <group position={h.pos}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 0.38]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh position={[0, 0.6, 0]} material={getMaterial('#5b4a6b')} castShadow>
        <cylinderGeometry args={[0.32, 0.4, 1.2, 10]} />
      </mesh>
      <group ref={arm} position={[0, h.height, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={warnMat} castShadow>
          <cylinderGeometry args={[BAR_R, BAR_R, L * 2, 10]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * L, 0, 0]} material={getMaterial('#ffd25a', { roughness: 0.3, metalness: 0.6 })}>
            <sphereGeometry args={[0.28, 10, 8]} />
          </mesh>
        ))}
        <mesh material={getMaterial('#ffd25a', { roughness: 0.3, metalness: 0.6 })}>
          <cylinderGeometry args={[0.45, 0.45, 0.3, 10]} />
        </mesh>
      </group>
    </group>
  );
}

export default function Hazards({ level }) {
  return level.hazards.map((h, i) => {
    if (h.type === 'spikes') return <Spikes key={i} h={h} />;
    if (h.type === 'pulseSpikes') return <PulseSpikes key={i} h={h} />;
    if (h.type === 'sweeper') return <Sweeper key={i} h={h} />;
    return null;
  });
}
