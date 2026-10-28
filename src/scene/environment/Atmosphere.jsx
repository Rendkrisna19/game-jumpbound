import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Object3D, PlaneGeometry, ShaderMaterial, Vector3, InstancedMesh } from 'three';
import { playerState } from '../../game/playerState';
import { useGame } from '../../game/store';
import { createRng, hashString } from '../../game/math/random';
import { blobGeometry } from '../geometry';
import { getMaterial } from '../materials';

// ---------------------------------------------------------------- sky
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uBottom, pow(-h, 0.45));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSun * (pow(s, 900.0) * 2.5 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function SkyDome({ theme }) {
  const ref = useRef(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color(theme.sky.top) },
          uHorizon: { value: new Color(theme.sky.horizon) },
          uBottom: { value: new Color(theme.sky.bottom) },
          uSun: { value: new Color(theme.sky.sun) },
          uSunDir: { value: new Vector3(...theme.light.sunDir).normalize() },
        },
      }),
    [theme],
  );
  useFrame(({ camera }) => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- lights
const SHADOW_SIZE = { low: 0, medium: 1024, high: 2048 };

export function Lighting({ theme, quality, follow = true }) {
  const light = useRef(null);
  const target = useMemo(() => new Object3D(), []);
  const dir = useMemo(() => new Vector3(...theme.light.sunDir).normalize(), [theme]);
  const shadows = quality !== 'low';
  const size = SHADOW_SIZE[quality] || 1024;

  useFrame(() => {
    if (!light.current) return;
    const p = follow ? playerState.position : { x: 0, y: 0, z: 0 };
    // Snap to a coarse grid so the shadow map doesn't shimmer while moving.
    const sx = Math.round(p.x * 2) / 2;
    const sy = Math.round(p.y * 2) / 2;
    const sz = Math.round(p.z * 2) / 2;
    light.current.position.set(sx + dir.x * 40, sy + dir.y * 40, sz + dir.z * 40);
    target.position.set(sx, sy, sz);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={[theme.light.hemiSky, theme.light.hemiGround, theme.light.hemiIntensity]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={light}
        target={target}
        color={theme.light.sun}
        intensity={theme.light.sunIntensity}
        castShadow={shadows}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <primitive object={target} />
    </>
  );
}

// ---------------------------------------------------------------- floor (sea / gorge / cloud sea)
export function Floor({ theme, center }) {
  const ref = useRef(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(520, 520, 44, 44);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);
  const f = theme.floor;
  const material = useMemo(
    () => getMaterial(f.color, { flat: true, roughness: f.type === 'sea' ? 0.35 : 0.95, metalness: f.type === 'sea' ? 0.1 : 0 }),
    [f],
  );
  const amp = f.type === 'sea' ? 0.7 : f.type === 'clouds' ? 1.6 : 0;
  const acc = useRef(0);

  useFrame((_, delta) => {
    if (!amp || !ref.current) return;
    const screen = useGame.getState().screen;
    if (screen === 'paused') return;
    acc.current += Math.min(delta, 0.05);
    const t = acc.current;
    const pos = geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      arr[i * 3 + 1] = Math.sin(x * 0.07 + t * 0.9) * amp + Math.cos(z * 0.09 + t * 0.7) * amp * 0.8;
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={ref} geometry={geometry} material={material} position={[center[0], f.y, center[2]]} receiveShadow={false} />
  );
}

// ---------------------------------------------------------------- clouds (single instanced mesh)
export function Clouds({ theme, center, count = 14, spread = 120 }) {
  const ref = useRef(null);
  const puffs = useMemo(() => {
    const rng = createRng(hashString(theme.key) + 99);
    const out = [];
    const below = theme.floor.type === 'clouds';
    for (let c = 0; c < count; c++) {
      const cx = center[0] + rng.range(-spread, spread);
      const cz = center[2] + rng.range(-spread * 1.2, spread * 0.6);
      const cy = below && c % 2 === 0 ? rng.range(-16, -8) : rng.range(14, 34);
      const s = rng.range(2.2, 4.2);
      const n = rng.int(4, 6);
      for (let i = 0; i < n; i++) {
        out.push({
          x: cx + (i - n / 2) * s * 0.75 + rng.range(-0.5, 0.5),
          y: cy + rng.range(-0.4, 0.8) * s * 0.4,
          z: cz + rng.range(-1, 1) * s * 0.5,
          s: s * rng.range(0.55, 1),
          speed: 0.6 + (c % 3) * 0.25,
        });
      }
    }
    return out;
  }, [theme, center, count, spread]);

  const mesh = useMemo(() => {
    const m = new InstancedMesh(blobGeometry(1), getMaterial('#ffffff', { flat: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.18 }), puffs.length);
    m.frustumCulled = false;
    return m;
  }, [puffs]);

  const dummy = useMemo(() => new Object3D(), []);
  const offset = useRef(0);
  useFrame((_, delta) => {
    if (useGame.getState().screen !== 'paused') offset.current += Math.min(delta, 0.05);
    const t = offset.current;
    const range = spread * 2.4;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      let x = p.x + t * p.speed;
      x = ((((x - center[0] + range / 2) % range) + range) % range) + center[0] - range / 2;
      dummy.position.set(x, p.y, p.z);
      dummy.scale.set(p.s, p.s * 0.62, p.s * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive ref={ref} object={mesh} />;
}

// ---------------------------------------------------------------- distant scenery (no physics)
export function Scenery({ theme, center, palette }) {
  const items = useMemo(() => {
    const rng = createRng(hashString(theme.key) + 7);
    const out = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const r = rng.range(70, 125);
      out.push({
        x: center[0] + Math.cos(a) * r,
        z: center[2] + Math.sin(a) * r * 1.1,
        y: rng.range(-6, 14),
        s: rng.range(4, 11),
        h: rng.range(25, 60),
        rot: rng.range(0, Math.PI),
      });
    }
    return out;
  }, [theme, center]);

  const top = getMaterial(palette.top);
  const side = getMaterial(palette.side);
  const rock = getMaterial(palette.rock);
  const trim = getMaterial(palette.trim, { flat: true, roughness: 0.4, metalness: 0.3 });

  return (
    <group>
      {items.map((it, i) => {
        if (theme.key === 'canyon') {
          // towering mesas rising out of the gorge
          return (
            <group key={i} position={[it.x, it.y - it.h / 2, it.z]} rotation={[0, it.rot, 0]}>
              <mesh material={side}>
                <cylinderGeometry args={[it.s * 0.8, it.s, it.h, 6]} />
              </mesh>
              <mesh material={top} position={[0, it.h / 2 + 0.4, 0]}>
                <cylinderGeometry args={[it.s * 0.85, it.s * 0.8, 0.8, 6]} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={[it.x, it.y, it.z]} rotation={[0, it.rot, 0]}>
            <mesh material={top}>
              <cylinderGeometry args={[it.s, it.s * 0.95, 0.8, 8]} />
            </mesh>
            <mesh material={rock} position={[0, -it.s * 0.9, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[it.s * 0.92, it.s * 1.6, 7]} />
            </mesh>
            {theme.key === 'temple' ? (
              <>
                <mesh material={top} position={[it.s * 0.4, 1.8, 0]}>
                  <cylinderGeometry args={[0.5, 0.55, 3.2, 8]} />
                </mesh>
                <mesh material={trim} position={[-it.s * 0.3, 0.9, it.s * 0.2]}>
                  <boxGeometry args={[1.6, 1.4, 1.6]} />
                </mesh>
              </>
            ) : (
              <mesh material={getMaterial(palette.topDark)} position={[it.s * 0.2, 1.6 + it.s * 0.2, 0]}>
                <icosahedronGeometry args={[1.2 + it.s * 0.18, 0]} />
              </mesh>
            )}
            <mesh material={side} position={[0, -0.6, 0]}>
              <cylinderGeometry args={[it.s * 0.95, it.s * 0.9, 0.6, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
