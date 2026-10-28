import {
  CylinderGeometry,
  ConeGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  DodecahedronGeometry,
  BoxGeometry,
} from 'three';

// Cached procedural geometries. Everything here is generated once and shared.
const cache = new Map();

function cached(key, build) {
  let g = cache.get(key);
  if (!g) {
    g = build();
    cache.set(key, g);
  }
  return g;
}

function hash3(x, y, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Organic low-poly jitter. Vertices sharing a position move identically (no cracks).
 * Vertices whose y is within `lockAbove` of the top keep their position.
 */
function jitter(geo, amount, seed, lockAboveY = Infinity) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y >= lockAboveY - 1e-4) continue;
    const kx = Math.round(x * 100);
    const ky = Math.round(y * 100);
    const kz = Math.round(z * 100);
    const a = hash3(kx, ky, kz, seed) - 0.5;
    const b = hash3(kz, kx, ky, seed + 7) - 0.5;
    const s = 1 + a * amount;
    pos.setXYZ(i, x * s, y + b * amount * 0.8, z * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Floating island pieces: grass cap, soil band and rocky underside (top surface at y = 0). */
export function islandGeometry(radius, depth, seed = 1) {
  const key = `island|${radius}|${depth}|${seed}`;
  return cached(key, () => {
    const seg = Math.max(9, Math.round(radius * 3.2));
    const capH = 0.34;
    const top = new CylinderGeometry(radius, radius * 0.985, capH, seg, 1);
    top.translate(0, -capH / 2, 0);

    const bandH = Math.max(0.3, depth - capH);
    const band = new CylinderGeometry(radius * 0.985, radius * 0.86, bandH, seg, 2);
    jitter(band, 0.08, seed, bandH / 2);
    band.translate(0, -capH - bandH / 2, 0);

    const rockH = radius * 1.35 + 1;
    const rock = new ConeGeometry(radius * 0.86, rockH, seg, 4);
    rock.rotateX(Math.PI);
    jitter(rock, 0.28, seed + 3, rockH / 2);
    rock.translate(0, -depth - rockH / 2 + 0.02, 0);
    return { top, band, rock, rockH };
  });
}

export function cylinderGeometry(rTop, rBottom, h, seg = 10) {
  return cached(`cyl|${rTop}|${rBottom}|${h}|${seg}`, () => new CylinderGeometry(rTop, rBottom, h, seg));
}

export function boxGeometry(w, h, d) {
  return cached(`box|${w}|${h}|${d}`, () => new BoxGeometry(w, h, d));
}

export function coneGeometry(r, h, seg = 6) {
  return cached(`cone|${r}|${h}|${seg}`, () => new ConeGeometry(r, h, seg));
}

export function crystalGeometry() {
  return cached('crystal', () => {
    const g = new OctahedronGeometry(0.3, 0);
    g.scale(0.85, 1.45, 0.85);
    return g;
  });
}

export function blobGeometry(detail = 0) {
  return cached(`blob|${detail}`, () => new IcosahedronGeometry(1, detail));
}

export function rockGeometry() {
  return cached('rock', () => jitter(new DodecahedronGeometry(1, 0), 0.25, 5));
}

/** Tall crystal shard (pointy hexagonal prism). */
export function shardGeometry() {
  return cached('shard', () => {
    const g = new CylinderGeometry(0, 0.5, 1, 6, 1);
    const tip = g;
    tip.translate(0, 0.5, 0);
    return tip;
  });
}
