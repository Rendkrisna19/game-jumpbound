import { useLayoutEffect, useMemo, useRef } from 'react';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { Color, CylinderGeometry, IcosahedronGeometry, Object3D, SphereGeometry, BoxGeometry, ConeGeometry } from 'three';
import { createRng, hashString } from '../../game/math/random';
import { footprint } from '../../game/levels/geometry';
import { getMaterial } from '../materials';
import { rockGeometry, shardGeometry } from '../geometry';

// ---------------------------------------------------------------- shared geometries (built once)
const G = {
  trunk: new CylinderGeometry(0.14, 0.22, 1.6, 6).translate(0, 0.8, 0),
  blob: new IcosahedronGeometry(1, 0),
  stem: new CylinderGeometry(0.02, 0.025, 0.32, 4).translate(0, 0.16, 0),
  head: new IcosahedronGeometry(0.1, 0),
  blade: new ConeGeometry(0.07, 0.4, 3).translate(0, 0.2, 0),
  mStem: new CylinderGeometry(0.07, 0.09, 0.3, 6).translate(0, 0.15, 0),
  mCap: new SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  column: new CylinderGeometry(0.3, 0.32, 1, 10).translate(0, 0.5, 0),
  slab: new BoxGeometry(0.85, 0.18, 0.85),
  post: new CylinderGeometry(0.06, 0.08, 1.3, 6).translate(0, 0.65, 0),
  bulb: new IcosahedronGeometry(0.16, 1),
};

const KINDS = {
  tree: { blocker: true, inset: 1.1 },
  column: { blocker: true, inset: 0.7 },
  lantern: { blocker: true, inset: 0.5 },
  rock: { blocker: true, inset: 0.7 },
  crystal: { blocker: true, inset: 0.7 },
  mushroom: { blocker: false, inset: 0.4 },
  flower: { blocker: false, inset: 0.35 },
  grass: { blocker: false, inset: 0.3 },
  shrub: { blocker: false, inset: 0.5 },
};

const distToSegment = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

/** Seeded, collision-aware scatter of decoration instances for a level. */
export function generateDecor(level, density = 1) {
  const rng = createRng(hashString(level.id));
  const byId = new Map(level.platforms.map((p) => [p.id, p]));
  const out = {};
  const colliders = [];
  const placedBlockers = [];

  // Points & segments gameplay needs kept clear of solid decorations.
  const keepClear = [];
  for (const c of level.crystals) keepClear.push({ x: c[0], z: c[2], r: 0.9 });
  for (const s of level.sunstones) keepClear.push({ x: s[0], z: s[2], r: 1.2 });
  for (const c of level.checkpoints) keepClear.push({ x: c.pos[0], z: c.pos[2], r: 2.0 });
  keepClear.push({ x: level.portal.pos[0], z: level.portal.pos[2], r: 3.2 });
  keepClear.push({ x: level.spawn[0], z: level.spawn[2], r: 2.2 });
  for (const h of level.hazards) {
    const r = h.type === 'sweeper' ? h.length + 0.8 : Math.max(...(h.size || [1, 1])) * 0.8 + 0.8;
    keepClear.push({ x: h.pos[0], z: h.pos[2], r });
  }
  const segments = [];
  for (const e of level.enemies) {
    if (e.type === 'wanderer') segments.push({ a: e.from, b: e.to, r: 1.6 });
    else keepClear.push({ x: e.home[0], z: e.home[2], r: (e.radius ?? 3) + 1 });
  }
  // Route corridors: from each platform centre towards its route neighbours.
  for (const route of level.routes) {
    const ids = route.map((r) => (typeof r === 'string' ? r : r.id));
    for (let i = 1; i < ids.length; i++) {
      const a = byId.get(ids[i - 1]);
      const b = byId.get(ids[i]);
      if (a && b) segments.push({ a: a.pos, b: b.pos, r: 2.0 });
    }
  }

  const isClear = (x, y, z) => {
    for (const k of keepClear) if (Math.hypot(x - k.x, z - k.z) < k.r) return false;
    for (const s of segments) {
      if (y < Math.min(s.a[1], s.b[1]) - 1 || y > Math.max(s.a[1], s.b[1]) + 1) continue;
      if (distToSegment(x, z, s.a[0], s.a[2], s.b[0], s.b[2]) < s.r) return false;
    }
    for (const b of placedBlockers) if (Math.hypot(x - b.x, z - b.z) < 1.4) return false;
    return true;
  };

  const add = (kind, item) => {
    (out[kind] ||= []).push(item);
  };

  for (const p of level.platforms) {
    if (!p.decor) continue;
    const f = footprint(p);
    for (const [kind, rawCount] of Object.entries(p.decor)) {
      const cfg = KINDS[kind];
      if (!cfg) continue;
      const count = cfg.blocker ? rawCount : Math.round(rawCount * density);
      for (let n = 0; n < count; n++) {
        let placed = false;
        for (let tries = 0; tries < 30 && !placed; tries++) {
          let x;
          let z;
          if (f.kind === 'circle') {
            const maxR = f.r - cfg.inset;
            if (maxR <= 0) break;
            const r = Math.sqrt(rng.next()) * maxR;
            const a = rng.next() * Math.PI * 2;
            x = f.x + Math.cos(a) * r;
            z = f.z + Math.sin(a) * r;
          } else {
            const hw = f.hw - cfg.inset;
            const hd = f.hd - cfg.inset;
            if (hw <= 0 || hd <= 0) break;
            x = f.x + rng.range(-hw, hw);
            z = f.z + rng.range(-hd, hd);
          }
          const y = p.pos[1];
          if (cfg.blocker && !isClear(x, y, z)) continue;
          placed = true;
          const s = rng.range(0.75, 1.25);
          const rot = rng.range(0, Math.PI * 2);
          add(kind, { x, y, z, s, rot, v: rng.next() });
          if (cfg.blocker) placedBlockers.push({ x, z });
          if (kind === 'tree') colliders.push({ x, y, z, r: 0.28 * s, h: 1.6 * s });
          if (kind === 'column') colliders.push({ x, y, z, r: 0.34, h: 1.4 + s });
          if (kind === 'lantern') colliders.push({ x, y, z, r: 0.12, h: 1.3 });
          if (kind === 'crystal') colliders.push({ x, y, z, r: 0.35 * s, h: 0.9 * s });
        }
      }
    }
  }
  return { items: out, colliders };
}

// ---------------------------------------------------------------- instanced renderer
function Instanced({ geometry, material, items, castShadow = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const color = new Color();
    items.forEach((it, i) => {
      dummy.position.set(it.p[0], it.p[1], it.p[2]);
      dummy.rotation.set(it.r?.[0] ?? 0, it.r?.[1] ?? 0, it.r?.[2] ?? 0);
      dummy.scale.set(it.s[0], it.s[1], it.s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (it.c) mesh.setColorAt(i, color.set(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

const TREE_GREENS = ['#4fc24a', '#3eab48', '#68d457', '#58b84a'];
const FLOWER_COLORS = { meadow: ['#ffd84a', '#ff7ab6', '#ffffff', '#b78cff', '#ff9b3d'], canyon: ['#ffd84a', '#ff9b3d'], temple: ['#ffffff', '#f6b8d9', '#c9a6ff', '#ffe08a'] };
const GRASS = { meadow: ['#4dbb45', '#3fa546', '#62c94f'], canyon: ['#c99a4a', '#b5813d'], temple: ['#9ccf7e', '#83bf74'] };
const CAPS = ['#ff8a3d', '#9b6bff', '#2fd6c2'];
const CRYSTALS = ['#b98cff', '#7fdcff', '#ff9be0'];

export default function Decorations({ level, quality }) {
  const theme = level.theme.key;
  const pal = level.theme.palette;
  const density = quality === 'low' ? 0.45 : quality === 'medium' ? 0.8 : 1;
  const { items, colliders } = useMemo(() => generateDecor(level, density), [level, density]);

  const parts = useMemo(() => {
    const P = {
      trunk: [], foliage: [], stem: [], head: [], blade: [], rock: [], mStem: [], mCap: [],
      shard: [], shrub: [], column: [], slab: [], post: [], bulb: [],
    };
    for (const t of items.tree ?? []) {
      P.trunk.push({ p: [t.x, t.y, t.z], s: [t.s, t.s, t.s], r: [0, t.rot, 0] });
      const blobs = [[0, 1.95, 0, 0.95], [0.38, 2.5, 0.1, 0.68], [-0.32, 2.35, -0.22, 0.62]];
      blobs.forEach(([bx, by, bz, bs], i) => {
        const c = TREE_GREENS[(Math.floor(t.v * 4) + i) % TREE_GREENS.length];
        P.foliage.push({ p: [t.x + bx * t.s, t.y + by * t.s, t.z + bz * t.s], s: [bs * t.s, bs * t.s * 0.9, bs * t.s], r: [0, t.rot + i, 0], c });
      });
    }
    const fCols = FLOWER_COLORS[theme] ?? FLOWER_COLORS.meadow;
    for (const f of items.flower ?? []) {
      P.stem.push({ p: [f.x, f.y, f.z], s: [1, f.s, 1] });
      P.head.push({ p: [f.x, f.y + 0.32 * f.s, f.z], s: [f.s, f.s * 0.8, f.s], r: [0, f.rot, 0], c: fCols[Math.floor(f.v * fCols.length)] });
    }
    const gCols = GRASS[theme] ?? GRASS.meadow;
    for (const g of items.grass ?? []) {
      for (let i = 0; i < 3; i++) {
        const a = g.rot + i * 2.1;
        P.blade.push({
          p: [g.x + Math.cos(a) * 0.08, g.y, g.z + Math.sin(a) * 0.08],
          s: [g.s, g.s * (0.8 + i * 0.15), g.s],
          r: [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3],
          c: gCols[(i + Math.floor(g.v * 3)) % gCols.length],
        });
      }
    }
    for (const r of items.rock ?? []) {
      const s = 0.28 + r.v * 0.3;
      P.rock.push({ p: [r.x, r.y + s * 0.3, r.z], s: [s * 1.2, s * 0.8, s], r: [0, r.rot, 0], c: pal.rock });
    }
    for (const m of items.mushroom ?? []) {
      P.mStem.push({ p: [m.x, m.y, m.z], s: [m.s, m.s, m.s] });
      P.mCap.push({ p: [m.x, m.y + 0.28 * m.s, m.z], s: [m.s, m.s * 0.8, m.s], c: CAPS[Math.floor(m.v * CAPS.length)] });
    }
    for (const c of items.crystal ?? []) {
      const n = 3 + Math.floor(c.v * 3);
      for (let i = 0; i < n; i++) {
        const a = c.rot + (i / n) * Math.PI * 2;
        const h = (i === 0 ? 1.5 : 0.7 + ((i * 37) % 10) / 20) * c.s;
        P.shard.push({
          p: [c.x + (i ? Math.cos(a) * 0.25 : 0), c.y - 0.05, c.z + (i ? Math.sin(a) * 0.25 : 0)],
          s: [0.35 * c.s, h, 0.35 * c.s],
          r: [i ? Math.sin(a) * 0.45 : 0, 0, i ? -Math.cos(a) * 0.45 : 0],
          c: CRYSTALS[(i + Math.floor(c.v * 3)) % CRYSTALS.length],
        });
      }
    }
    for (const s of items.shrub ?? []) {
      P.shrub.push({ p: [s.x, s.y + 0.18 * s.s, s.z], s: [0.42 * s.s, 0.3 * s.s, 0.42 * s.s], r: [0, s.rot, 0], c: s.v > 0.5 ? '#b0a13f' : '#c98a3c' });
    }
    for (const c of items.column ?? []) {
      const h = 1.4 + c.s;
      P.column.push({ p: [c.x, c.y, c.z], s: [1, h, 1], r: [0, c.rot, 0] });
      P.slab.push({ p: [c.x, c.y + h + 0.09, c.z], s: [1, 1, 1], r: [0, c.rot, 0] });
      P.slab.push({ p: [c.x, c.y + 0.09, c.z], s: [1, 1, 1], r: [0, c.rot, 0] });
    }
    for (const l of items.lantern ?? []) {
      P.post.push({ p: [l.x, l.y, l.z], s: [1, 1, 1] });
      P.bulb.push({ p: [l.x, l.y + 1.42, l.z], s: [1, 1, 1] });
    }
    return P;
  }, [items, theme, pal]);

  const white = getMaterial('#ffffff');
  const shadows = quality !== 'low';

  return (
    <>
      {colliders.length > 0 && (
        <RigidBody type="fixed" colliders={false}>
          {colliders.map((c, i) => (
            <CylinderCollider key={i} args={[c.h / 2, c.r]} position={[c.x, c.y + c.h / 2, c.z]} />
          ))}
        </RigidBody>
      )}
      <Instanced geometry={G.trunk} material={getMaterial(pal.woodDark)} items={parts.trunk} castShadow={shadows} />
      <Instanced geometry={G.blob} material={white} items={parts.foliage} castShadow={shadows} />
      <Instanced geometry={G.stem} material={getMaterial('#3c9a3f')} items={parts.stem} />
      <Instanced geometry={G.head} material={white} items={parts.head} />
      <Instanced geometry={G.blade} material={white} items={parts.blade} />
      <Instanced geometry={rockGeometry()} material={white} items={parts.rock} castShadow={shadows} />
      <Instanced geometry={G.mStem} material={getMaterial('#f5ead2')} items={parts.mStem} />
      <Instanced geometry={G.mCap} material={getMaterial('#ffffff', { flat: false, roughness: 0.6 })} items={parts.mCap} />
      <Instanced geometry={shardGeometry()} material={getMaterial('#ffffff', { roughness: 0.25, emissive: '#5a2fb0', emissiveIntensity: 0.45 })} items={parts.shard} castShadow={shadows} />
      <Instanced geometry={G.blob} material={white} items={parts.shrub} />
      <Instanced geometry={G.column} material={getMaterial(pal.topDark)} items={parts.column} castShadow={shadows} />
      <Instanced geometry={G.slab} material={getMaterial(pal.trim, { roughness: 0.35, metalness: 0.5 })} items={parts.slab} />
      <Instanced geometry={G.post} material={getMaterial('#5b4a6b')} items={parts.post} />
      <Instanced geometry={G.bulb} material={getMaterial('#ffe08a', { emissive: '#ffc940', emissiveIntensity: 1.6 })} items={parts.bulb} />
    </>
  );
}
