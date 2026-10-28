import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MeshStandardMaterial, Vector3 } from 'three';
import { getMaterial } from '../materials';
import { playerState, playerApi, addCameraTrauma } from '../../game/playerState';
import { capsuleSphere, isStomp } from '../../game/math/collision';
import { gameClock, MAX_DT } from '../../game/clock';
import { getGame, isPlaying, session } from '../../game/store';
import { spawnBurst } from '../../game/effects';
import { audio } from '../../audio/AudioManager';

/** Live enemy positions, read by the debug hook used in automated tests. */
export const enemyDebug = new Map();

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** Volume falloff so far-away enemies don't spam audio. */
const distVolume = (x, z) => Math.max(0, 1 - Math.hypot(playerState.position.x - x, playerState.position.z - z) / 16);

// =====================================================================================
// FOREST WANDERER — a mossy, round little critter that patrols between two points.
// Defeated by jumping on it. Touching it from the side hurts.
// =====================================================================================
const W_RADIUS = 0.55;
const W = {
  body: getMaterial('#5fae3e', { flat: false, roughness: 0.8 }),
  belly: getMaterial('#a7d86a', { flat: false, roughness: 0.8 }),
  leaf: getMaterial('#2f8f3a'),
  foot: getMaterial('#6a4428', { flat: false }),
  eye: getMaterial('#ffffff', { flat: false, roughness: 0.3 }),
  pupil: getMaterial('#1d1530', { flat: false }),
  brow: getMaterial('#2a3d1a'),
  flower: getMaterial('#ff8ac6', { emissive: '#ff4fa8', emissiveIntensity: 0.3 }),
};

function Wanderer({ id, cfg }) {
  const root = useRef(null);
  const body = useRef(null);
  const footL = useRef(null);
  const footR = useRef(null);
  const from = useMemo(() => new Vector3(...cfg.from), [cfg]);
  const to = useMemo(() => new Vector3(...cfg.to), [cfg]);
  const len = useMemo(() => Math.max(0.01, from.distanceTo(to)), [from, to]);
  const st = useRef({ t: 0.5, dir: 1, wait: 0, yaw: 0, defeatedAt: session.defeated.has(id) ? -100 : null, walk: 0 });

  useFrame((_, delta) => {
    const g = root.current;
    if (!g) return;
    const s = st.current;
    const now = gameClock.time;

    if (s.defeatedAt !== null) {
      const k = (now - s.defeatedAt) / 0.6;
      g.visible = k < 1;
      if (body.current) body.current.scale.set(1 + k * 0.6, Math.max(0.12, 1 - k * 4), 1 + k * 0.6);
      return;
    }
    if (!isPlaying()) return;
    const dt = Math.min(delta, MAX_DT);

    // ---- patrol ----
    if (s.wait > 0) {
      s.wait -= dt;
    } else {
      s.t += (s.dir * (cfg.speed ?? 1.6) * dt) / len;
      if (s.t >= 1 || s.t <= 0) {
        s.t = Math.min(1, Math.max(0, s.t));
        s.dir *= -1;
        s.wait = 0.45;
      }
      s.walk += dt * 9;
    }
    const x = from.x + (to.x - from.x) * s.t;
    const y = from.y + (to.y - from.y) * s.t;
    const z = from.z + (to.z - from.z) * s.t;
    const targetYaw = Math.atan2((to.x - from.x) * s.dir, (to.z - from.z) * s.dir);
    s.yaw = lerpAngle(s.yaw, targetYaw, 1 - Math.exp(-8 * dt));
    const hop = s.wait > 0 ? 0 : Math.abs(Math.sin(s.walk)) * 0.08;
    g.position.set(x, y + hop, z);
    g.rotation.y = s.yaw;
    enemyDebug.set(id, { type: 'wanderer', x, y, z, vx: ((to.x - from.x) / len) * s.dir * (s.wait > 0 ? 0 : cfg.speed ?? 1.6), vz: ((to.z - from.z) / len) * s.dir * (s.wait > 0 ? 0 : cfg.speed ?? 1.6), alive: true });
    if (footL.current) footL.current.position.z = 0.1 + Math.sin(s.walk) * 0.14;
    if (footR.current) footR.current.position.z = 0.1 - Math.sin(s.walk) * 0.14;
    if (body.current) body.current.scale.set(1, 1 + Math.sin(s.walk * 2) * 0.03, 1);

    // ---- collision with the player ----
    if (playerState.dead || playerState.celebrating) return;
    const cy = y + W_RADIUS + 0.05;
    const cap = playerState.capsule;
    if (capsuleSphere(cap, x, cy, z, W_RADIUS)) {
      if (isStomp(cap, playerState.velocity.y, cy, 0.35)) {
        if (getGame().defeatEnemy(id, 'wanderer')) {
          s.defeatedAt = now;
          enemyDebug.delete(id);
          playerApi.bounce();
          audio.play('stomp');
          addCameraTrauma(0.12);
          spawnBurst([x, cy, z], { color: '#8fd65a', count: 16, speed: 3.5, up: 2.5 });
        }
      } else {
        playerApi.hurt({ x, z });
      }
    }
  });

  return (
    <group ref={root} position={cfg.from}>
      <group ref={body}>
        <mesh position={[0, 0.58, 0]} material={W.body} castShadow>
          <sphereGeometry args={[W_RADIUS, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.45, 0.32]} scale={[1, 0.85, 0.55]} material={W.belly}>
          <sphereGeometry args={[0.36, 12, 10]} />
        </mesh>
        {/* leafy crown */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.256) * 0.18, 1.1, Math.sin(i * 1.256) * 0.18]} rotation={[Math.sin(i * 1.256) * 0.6, 0, -Math.cos(i * 1.256) * 0.6]} material={W.leaf}>
            <coneGeometry args={[0.12, 0.42, 4]} />
          </mesh>
        ))}
        <mesh position={[0.12, 1.28, 0]} material={W.flower}>
          <icosahedronGeometry args={[0.1, 0]} />
        </mesh>
        {/* eyes + brows */}
        {[-0.18, 0.18].map((ex) => (
          <group key={ex} position={[ex, 0.74, 0.42]}>
            <mesh material={W.eye} scale={[1, 1.2, 0.6]}>
              <sphereGeometry args={[0.13, 10, 8]} />
            </mesh>
            <mesh material={W.pupil} position={[0, -0.01, 0.07]} scale={[1, 1.3, 0.6]}>
              <sphereGeometry args={[0.06, 8, 6]} />
            </mesh>
            <mesh material={W.brow} position={[0, 0.17, 0.04]} rotation={[0, 0, ex > 0 ? 0.35 : -0.35]}>
              <boxGeometry args={[0.18, 0.04, 0.04]} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh ref={footL} position={[-0.22, 0.08, 0.1]} scale={[1, 0.6, 1.3]} material={W.foot} castShadow>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh ref={footR} position={[0.22, 0.08, 0.1]} scale={[1, 0.6, 1.3]} material={W.foot} castShadow>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
    </group>
  );
}

// =====================================================================================
// CRYSTAL GUARDIAN — hovers over the platform it protects. When the player comes close
// it telegraphs (glows red & shakes), dashes at the player's position, then rests dazed.
// It can only be defeated by stomping it while it rests.
// =====================================================================================
const G_RADIUS = 0.62;
const COLORS = {
  idle: new Color('#9b6bff'),
  alert: new Color('#ff3d6e'),
  rest: new Color('#7f8aa6'),
};

function Guardian({ id, cfg }) {
  const root = useRef(null);
  const core = useRef(null);
  const shards = useRef(null);
  const stars = useRef(null);
  const home = useMemo(() => new Vector3(...cfg.home), [cfg]);
  const radius = cfg.radius ?? 3;
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#d9c6ff', emissive: COLORS.idle.clone(), emissiveIntensity: 0.7, flatShading: true, roughness: 0.25, metalness: 0.2 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const st = useRef({
    mode: session.defeated.has(id) ? 'dead' : 'idle',
    timer: 0,
    pos: home.clone(),
    target: new Vector3(),
    from: new Vector3(),
    defeatedAt: session.defeated.has(id) ? -100 : 0,
    bounceCooldown: 0,
  });

  useFrame((_, delta) => {
    const g = root.current;
    if (!g) return;
    const s = st.current;
    const now = gameClock.time;

    if (s.mode === 'dead') {
      const k = (now - s.defeatedAt) / 0.5;
      g.visible = k < 1;
      g.scale.setScalar(Math.max(0, 1 - k));
      return;
    }
    if (!isPlaying()) return;
    const dt = Math.min(delta, MAX_DT);
    const p = playerState.position;
    s.timer -= dt;
    s.bounceCooldown -= dt;

    const playerNear =
      !playerState.dead &&
      Math.hypot(p.x - home.x, p.z - home.z) < radius + 1.6 &&
      Math.abs(p.y - home.y) < 3;

    let shake = 0;
    let bob = Math.sin(now * 2.2) * 0.15;
    switch (s.mode) {
      case 'idle':
        s.pos.lerp(home, 1 - Math.exp(-3 * dt));
        if (playerNear && s.timer <= 0) {
          s.mode = 'alert';
          s.timer = 0.8;
          audio.play('charge', { volume: distVolume(s.pos.x, s.pos.z) });
        }
        break;
      case 'alert':
        shake = 0.06;
        bob = 0.25;
        if (s.timer <= 0) {
          // Lock the target where the player is now (fair: no homing), clamped to the guard zone.
          s.from.copy(s.pos);
          s.target.set(p.x, home.y, p.z);
          const dx = s.target.x - home.x;
          const dz = s.target.z - home.z;
          const d = Math.hypot(dx, dz);
          if (d > radius) {
            s.target.x = home.x + (dx / d) * radius;
            s.target.z = home.z + (dz / d) * radius;
          }
          s.target.y = Math.min(home.y, p.y + 0.1);
          s.mode = 'dash';
          s.timer = 0.5;
          audio.play('dash', { volume: distVolume(s.pos.x, s.pos.z) });
        }
        break;
      case 'dash': {
        const k = 1 - Math.max(0, s.timer) / 0.5;
        const e = 1 - (1 - k) * (1 - k);
        s.pos.lerpVectors(s.from, s.target, e);
        bob = 0;
        if (Math.floor(now * 30) % 2 === 0) spawnBurst(s.pos, { color: '#ff7aa8', count: 1, speed: 0.4, up: 0, gravity: 0, life: 0.35, size: 0.18 });
        if (s.timer <= 0) {
          s.mode = 'rest';
          s.timer = 1.8;
          addCameraTrauma(0.1 * distVolume(s.pos.x, s.pos.z));
        }
        break;
      }
      case 'rest':
        s.pos.y += (home.y - 0.55 - s.pos.y) * (1 - Math.exp(-6 * dt));
        bob = 0;
        if (s.timer <= 0) {
          s.mode = 'return';
          s.timer = 0.9;
          s.from.copy(s.pos);
        }
        break;
      case 'return': {
        const k = 1 - Math.max(0, s.timer) / 0.9;
        s.pos.lerpVectors(s.from, home, k * k * (3 - 2 * k));
        if (s.timer <= 0) {
          s.mode = 'idle';
          s.timer = 0.9; // cooldown before the next charge
        }
        break;
      }
      default:
        break;
    }

    enemyDebug.set(id, { type: 'guardian', mode: s.mode, x: s.pos.x, y: s.pos.y, z: s.pos.z });

    // ---- visuals ----
    g.position.set(s.pos.x + (Math.random() - 0.5) * shake, s.pos.y + bob, s.pos.z + (Math.random() - 0.5) * shake);
    const look = Math.atan2(p.x - s.pos.x, p.z - s.pos.z);
    if (s.mode !== 'rest') g.rotation.y = lerpAngle(g.rotation.y, look, 1 - Math.exp(-5 * dt));
    const targetColor = s.mode === 'alert' || s.mode === 'dash' ? COLORS.alert : s.mode === 'rest' ? COLORS.rest : COLORS.idle;
    material.emissive.lerp(targetColor, 1 - Math.exp(-10 * dt));
    material.emissiveIntensity = s.mode === 'alert' ? 0.9 + Math.sin(now * 30) * 0.4 : s.mode === 'rest' ? 0.25 : 0.7;
    if (core.current) core.current.rotation.y += dt * (s.mode === 'rest' ? 0.3 : 1.5);
    if (shards.current) {
      shards.current.rotation.y += dt * (s.mode === 'alert' ? 9 : s.mode === 'rest' ? 0.4 : 2);
      shards.current.position.y = s.mode === 'rest' ? -0.3 : 0;
    }
    if (stars.current) {
      stars.current.visible = s.mode === 'rest';
      stars.current.rotation.y = now * 4;
    }

    // ---- collision ----
    if (playerState.dead || playerState.celebrating) return;
    const cap = playerState.capsule;
    const cy = g.position.y;
    if (!capsuleSphere(cap, g.position.x, cy, g.position.z, G_RADIUS)) return;
    const stomp = isStomp(cap, playerState.velocity.y, cy, 0.4);
    if (s.mode === 'rest' && stomp) {
      if (getGame().defeatEnemy(id, 'guardian')) {
        s.mode = 'dead';
        enemyDebug.delete(id);
        s.defeatedAt = now;
        playerApi.bounce();
        audio.play('shatter');
        addCameraTrauma(0.25);
        spawnBurst([g.position.x, cy, g.position.z], { color: '#c9a6ff', count: 30, speed: 5, up: 3, size: 0.16 });
        spawnBurst([g.position.x, cy, g.position.z], { color: '#7fd8ff', count: 14, speed: 4, up: 2 });
      }
    } else if (stomp && s.bounceCooldown <= 0) {
      // Shielded while awake: bounce off harmlessly.
      s.bounceCooldown = 0.3;
      playerApi.bounce(9);
      audio.play('land');
    } else if (s.mode !== 'rest') {
      playerApi.hurt({ x: g.position.x, z: g.position.z }, { force: 1.1 });
    }
  });

  const stone = getMaterial('#6d6487');
  return (
    <group ref={root} position={cfg.home}>
      <group ref={core}>
        <mesh material={material} scale={[1, 1.35, 1]} castShadow>
          <octahedronGeometry args={[0.6, 0]} />
        </mesh>
        <mesh position={[0, 0.05, 0.42]} material={getMaterial('#ffffff', { flat: false })}>
          <sphereGeometry args={[0.15, 10, 8]} />
        </mesh>
        <mesh position={[0, 0.05, 0.54]} material={getMaterial('#1d1530', { flat: false })}>
          <sphereGeometry args={[0.07, 8, 6]} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} material={stone}>
        <torusGeometry args={[0.85, 0.09, 5, 10]} />
      </mesh>
      <group ref={shards}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.05, Math.sin(i * 2) * 0.2, Math.sin(a) * 1.05]} material={material} scale={[0.6, 1.2, 0.6]}>
              <octahedronGeometry args={[0.2, 0]} />
            </mesh>
          );
        })}
      </group>
      <group ref={stars} position={[0, 1.0, 0]} visible={false}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]} material={getMaterial('#ffe066', { emissive: '#ffcc00', emissiveIntensity: 1 })}>
              <octahedronGeometry args={[0.1, 0]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export default function Enemies({ level }) {
  useEffect(() => () => enemyDebug.clear(), [level]);
  return level.enemies.map((e, i) =>
    e.type === 'guardian' ? <Guardian key={i} id={`e${i}`} cfg={e} /> : <Wanderer key={i} id={`e${i}`} cfg={e} />,
  );
}
