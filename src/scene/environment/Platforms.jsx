import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { MeshStandardMaterial, Color } from 'three';
import { platformDepth, platformPositionAt, timedState } from '../../game/levels/geometry';
import { registerSurface, unregisterSurface } from '../../game/registry';
import { gameClock } from '../../game/clock';
import { hashString } from '../../game/math/random';
import { getMaterial } from '../materials';
import { islandGeometry, boxGeometry, cylinderGeometry, coneGeometry } from '../geometry';

/** Registers a collider in the surface registry once Rapier has created it. */
function useSurface(colliderRef, info) {
  const entry = useRef(null);
  useFrame(() => {
    if (!entry.current && colliderRef.current) {
      entry.current = registerSurface(colliderRef.current.handle, info);
    }
  });
  useEffect(
    () => () => {
      if (entry.current) unregisterSurface(entry.current.handle);
      entry.current = null;
    },
    [],
  );
  return entry;
}

// ---------------------------------------------------------------- visuals
function IslandVisual({ p, theme }) {
  const pal = theme.palette;
  const depth = platformDepth(p);
  const geo = islandGeometry(p.radius, depth, hashString(p.id) % 1000);
  const temple = theme.key === 'temple';
  return (
    <group position={p.pos}>
      <mesh geometry={geo.top} material={getMaterial(pal.top)} receiveShadow castShadow={false} />
      <mesh geometry={geo.band} material={getMaterial(pal.side)} receiveShadow />
      <mesh geometry={geo.rock} material={getMaterial(pal.rock)} />
      {temple && (
        <>
          <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={getMaterial(pal.trim, { roughness: 0.35, metalness: 0.5 })}>
            <torusGeometry args={[p.radius - 0.02, 0.08, 6, Math.max(12, Math.round(p.radius * 5))]} />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={getMaterial(pal.topDark)} receiveShadow>
            <ringGeometry args={[p.radius * 0.45, p.radius * 0.55, Math.max(12, Math.round(p.radius * 5))]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function BlockVisual({ p, theme }) {
  const pal = theme.palette;
  const [w, h, d] = p.size;
  const topH = 0.32;
  const canyon = theme.key === 'canyon';
  const temple = theme.key === 'temple';
  const layers = canyon ? Math.max(2, Math.floor((h - topH) / 1.3)) : 1;
  const layerH = (h - topH) / layers;
  const pyramidH = Math.max(w, d) * 0.9;
  return (
    <group position={p.pos}>
      <mesh position={[0, -topH / 2, 0]} geometry={boxGeometry(w, topH, d)} material={getMaterial(pal.top)} receiveShadow />
      {Array.from({ length: layers }, (_, i) => {
        const inset = canyon ? (i % 2 ? 0.06 : -0.04) : 0;
        return (
          <mesh
            key={i}
            position={[0, -topH - layerH * (i + 0.5), 0]}
            geometry={boxGeometry(w - 0.06 + inset, layerH, d - 0.06 + inset)}
            material={getMaterial(canyon && i % 2 ? pal.rock : pal.side)}
            receiveShadow
          />
        );
      })}
      <mesh position={[0, -h - pyramidH / 2 + 0.01, 0]} rotation={[Math.PI, Math.PI / 4, 0]} material={getMaterial(pal.rock)}>
        <coneGeometry args={[Math.max(w, d) * 0.68, pyramidH, 4]} />
      </mesh>
      {temple && (
        <mesh position={[0, -topH - 0.06, 0]} geometry={boxGeometry(w + 0.08, 0.12, d + 0.08)} material={getMaterial(pal.trim, { roughness: 0.35, metalness: 0.5 })} />
      )}
    </group>
  );
}

function BridgeVisual({ p, theme }) {
  const pal = theme.palette;
  const [w, t, d] = p.size;
  const alongZ = d >= w;
  const length = alongZ ? d : w;
  const width = alongZ ? w : d;
  const count = Math.max(2, Math.round(length / 0.55));
  const plankLen = length / count;
  const temple = theme.key === 'temple';
  const plankMat = getMaterial(temple ? pal.top : pal.wood);
  const plankAlt = getMaterial(temple ? pal.topDark : pal.woodDark);
  const railMat = getMaterial(temple ? pal.trim : pal.woodDark, temple ? { roughness: 0.35, metalness: 0.5 } : {});
  const plankGeo = boxGeometry(width, t, plankLen * 0.9);
  return (
    <group position={p.pos} rotation={[0, alongZ ? 0 : Math.PI / 2, 0]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          geometry={plankGeo}
          material={i % 2 ? plankAlt : plankMat}
          position={[0, -t / 2 - (i % 3 === 1 ? 0.02 : 0), -length / 2 + plankLen * (i + 0.5)]}
          receiveShadow
        />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2 + 0.06), 0, 0]}>
          <mesh position={[0, 0.55, 0]} material={railMat}>
            <boxGeometry args={[0.06, 0.06, length]} />
          </mesh>
          {[-length / 2 + 0.1, 0, length / 2 - 0.1].map((z) => (
            <mesh key={z} position={[0, 0.25, z]} material={railMat} castShadow>
              <boxGeometry args={[0.12, 0.7, 0.12]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function PillarVisual({ p, theme }) {
  const pal = theme.palette;
  const depth = platformDepth(p);
  const temple = theme.key === 'temple';
  return (
    <group position={p.pos}>
      <mesh position={[0, -0.15, 0]} geometry={cylinderGeometry(p.radius, p.radius, 0.3, 12)} material={getMaterial(pal.top)} receiveShadow />
      <mesh
        position={[0, -0.3 - (depth - 0.3) / 2, 0]}
        geometry={cylinderGeometry(p.radius * (temple ? 0.8 : 0.92), p.radius * (temple ? 0.8 : 0.75), depth - 0.3, temple ? 12 : 8)}
        material={getMaterial(temple ? pal.topDark : pal.rock)}
      />
      {temple && (
        <mesh position={[0, -0.35, 0]} geometry={cylinderGeometry(p.radius * 0.95, p.radius * 0.85, 0.15, 12)} material={getMaterial(pal.trim, { roughness: 0.35, metalness: 0.5 })} />
      )}
      <mesh position={[0, -depth - 0.8, 0]} rotation={[Math.PI, 0, 0]} geometry={coneGeometry(p.radius * 0.75, 1.6, 7)} material={getMaterial(pal.rock)} />
    </group>
  );
}

const CAP_COLOR = '#2fd6c2';
const SPOT_COLOR = '#fff36b';

function MushroomPad({ p, entryRef }) {
  const cap = useRef(null);
  const stemH = 1.4;
  useFrame(() => {
    if (!cap.current) return;
    const since = gameClock.time - (entryRef.current?.bouncedAt ?? -10);
    const k = since < 0.35 ? Math.sin((since / 0.35) * Math.PI) * (1 - since / 0.35) : 0;
    cap.current.scale.set(1 + k * 0.25, 1 - k * 0.4, 1 + k * 0.25);
  });
  const spots = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return [Math.cos(a) * p.radius * 0.6, 0.18, Math.sin(a) * p.radius * 0.6];
    }),
    [p.radius],
  );
  return (
    <group position={p.pos}>
      <mesh position={[0, -stemH / 2 - 0.2, 0]} material={getMaterial('#f7ecd2')} castShadow>
        <cylinderGeometry args={[0.32, 0.42, stemH, 10]} />
      </mesh>
      <group ref={cap}>
        <mesh position={[0, -0.25, 0]} material={getMaterial(CAP_COLOR, { flat: false, roughness: 0.5, emissive: '#0b6d63', emissiveIntensity: 0.4 })} castShadow receiveShadow>
          <sphereGeometry args={[p.radius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={getMaterial('#1ea896')}>
          <circleGeometry args={[p.radius, 18]} />
        </mesh>
        {spots.map((s, i) => (
          <mesh key={i} position={s} material={getMaterial(SPOT_COLOR, { emissive: SPOT_COLOR, emissiveIntensity: 0.8 })}>
            <sphereGeometry args={[0.13, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- dynamic platforms
function MovingPlatform({ p, theme }) {
  const rb = useRef(null);
  const col = useRef(null);
  const entry = useSurface(col, {});
  const tmp = useMemo(() => [0, 0, 0], []);
  const [w, h, d] = p.size;
  const start = useMemo(() => {
    const s = platformPositionAt(p, 0, [0, 0, 0]);
    return [s[0], s[1] - h / 2, s[2]];
  }, [p, h]);
  const glow = theme.palette.accent;

  useFrame(() => {
    const body = rb.current;
    if (!body) return;
    platformPositionAt(p, gameClock.time, tmp);
    const nx = tmp[0];
    const ny = tmp[1] - h / 2;
    const nz = tmp[2];
    const cur = body.translation();
    if (entry.current) entry.current.delta.set(nx - cur.x, ny - cur.y, nz - cur.z);
    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
  });

  return (
    <RigidBody ref={rb} type="kinematicPosition" colliders={false} position={start}>
      <CuboidCollider ref={col} args={[w / 2, h / 2, d / 2]} />
      <mesh geometry={boxGeometry(w, h, d)} material={getMaterial(theme.key === 'canyon' ? theme.palette.wood : theme.palette.top)} castShadow receiveShadow />
      <mesh position={[0, h / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={getMaterial(glow, { emissive: glow, emissiveIntensity: 0.6 })}>
        <ringGeometry args={[Math.min(w, d) * 0.3, Math.min(w, d) * 0.36, 16]} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.35, 0]} rotation={[Math.PI, 0, 0]} material={getMaterial(glow, { emissive: glow, emissiveIntensity: 0.9 })}>
        <octahedronGeometry args={[0.35, 0]} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.12), h / 2 + 0.03, sz * (d / 2 - 0.12)]} material={getMaterial(theme.palette.trim, { roughness: 0.4, metalness: 0.4 })}>
          <boxGeometry args={[0.2, 0.06, 0.2]} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function TimedPlatform({ p, theme }) {
  const rb = useRef(null);
  const visual = useRef(null);
  const solidRef = useRef(true);
  const [w, h, d] = p.size;
  const glowColor = theme.palette.accent;
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(theme.palette.top),
        emissive: new Color(glowColor),
        emissiveIntensity: 0.35,
        flatShading: true,
        roughness: 0.6,
        transparent: true,
      }),
    [theme, glowColor],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const state = timedState(p, gameClock.time);
    if (rb.current && state.solid !== solidRef.current) {
      solidRef.current = state.solid;
      rb.current.setEnabled(state.solid);
    }
    const g = visual.current;
    if (!g) return;
    if (state.solid) {
      const flicker = state.warning ? (Math.floor(gameClock.time * 12) % 2 ? 0.45 : 1) : 1;
      material.opacity = flicker;
      material.emissiveIntensity = state.warning ? 1.1 : 0.35;
      g.position.x = state.warning ? Math.sin(gameClock.time * 60) * 0.04 : 0;
      g.scale.setScalar(1);
    } else {
      material.opacity = 0.14;
      material.emissiveIntensity = 0.2;
      g.position.x = 0;
      g.scale.set(0.92, 0.6, 0.92);
    }
  });

  return (
    <RigidBody ref={rb} type="fixed" colliders={false} position={[p.pos[0], p.pos[1] - h / 2, p.pos[2]]}>
      <CuboidCollider args={[w / 2, h / 2, d / 2]} />
      <group ref={visual}>
        <mesh geometry={boxGeometry(w, h, d)} material={material} receiveShadow />
        <mesh position={[0, h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={getMaterial(glowColor, { emissive: glowColor, emissiveIntensity: 1 })}>
          <ringGeometry args={[Math.min(w, d) * 0.22, Math.min(w, d) * 0.3, 6]} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// ---------------------------------------------------------------- static colliders
function StaticCollider({ p }) {
  const depth = platformDepth(p);
  const [x, y, z] = p.pos;
  if (p.type === 'island' || p.type === 'pillar') {
    return <CylinderCollider args={[depth / 2, p.radius]} position={[x, y - depth / 2, z]} />;
  }
  if (p.type === 'mushroom') return null; // registered separately (needs a handle)
  const [w, h, d] = p.size;
  return <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[x, y - h / 2, z]} />;
}

function Mushroom({ p }) {
  const col = useRef(null);
  const entry = useSurface(col, { bounce: p.bounce });
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[p.pos[0], p.pos[1] - 0.25, p.pos[2]]}>
        <CylinderCollider ref={col} args={[0.25, p.radius]} />
        <CylinderCollider args={[0.7, 0.4]} position={[0, -0.95, 0]} />
      </RigidBody>
      <MushroomPad p={p} entryRef={entry} />
    </>
  );
}

// ---------------------------------------------------------------- level geometry
export default function Platforms({ level }) {
  const theme = level.theme;
  const statics = level.platforms.filter((p) => !['mover', 'timed', 'mushroom'].includes(p.type));
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {statics.map((p) => (
          <StaticCollider key={p.id} p={p} />
        ))}
      </RigidBody>
      {statics.map((p) => {
        switch (p.type) {
          case 'island':
            return <IslandVisual key={p.id} p={p} theme={theme} />;
          case 'bridge':
            return <BridgeVisual key={p.id} p={p} theme={theme} />;
          case 'pillar':
            return <PillarVisual key={p.id} p={p} theme={theme} />;
          default:
            return <BlockVisual key={p.id} p={p} theme={theme} />;
        }
      })}
      {level.platforms.map((p) => {
        if (p.type === 'mover') return <MovingPlatform key={p.id} p={p} theme={theme} />;
        if (p.type === 'timed') return <TimedPlatform key={p.id} p={p} theme={theme} />;
        if (p.type === 'mushroom') return <Mushroom key={p.id} p={p} />;
        return null;
      })}
    </>
  );
}
