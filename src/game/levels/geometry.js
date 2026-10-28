// Pure helpers describing platform shapes and motion. Shared by the renderer,
// the decoration scatter and the level validator (Node tests).

const TAU = Math.PI * 2;

export const CIRCULAR = new Set(['island', 'pillar', 'mushroom']);

/** Default visual/collider depth (thickness below the top surface). */
export function platformDepth(p) {
  if (p.type === 'island') return p.depth ?? 1.1;
  if (p.type === 'pillar') return p.depth ?? 6;
  if (p.type === 'mushroom') return 0.5;
  if (p.type === 'bridge') return p.size[1];
  return p.size?.[1] ?? 1;
}

/** Horizontal footprint at a given centre. */
export function footprint(p, x = p.pos[0], z = p.pos[2]) {
  if (CIRCULAR.has(p.type)) return { kind: 'circle', x, z, r: p.radius };
  return { kind: 'rect', x, z, hw: p.size[0] / 2, hd: p.size[2] / 2 };
}

/** Smooth ping-pong progress (0..1) for a moving platform at time t. */
export function moverProgress(p, t) {
  const phase = p.phase ?? 0;
  return 0.5 - 0.5 * Math.cos(TAU * (t / p.period + phase));
}

/** Top-centre position of a platform at time t (static platforms ignore t). */
export function platformPositionAt(p, t, out = [0, 0, 0]) {
  out[0] = p.pos[0];
  out[1] = p.pos[1];
  out[2] = p.pos[2];
  if (p.type === 'mover') {
    const s = moverProgress(p, t);
    out[0] += p.offset[0] * s;
    out[1] += p.offset[1] * s;
    out[2] += p.offset[2] * s;
  }
  return out;
}

/** Timed platform state: { solid, warning, fade } at time t. */
export function timedState(p, t) {
  const local = (((t + (p.phase ?? 0)) % p.period) + p.period) % p.period;
  const solid = local < p.on;
  const warning = solid && local > p.on - 0.9;
  return { solid, warning, local };
}

/** Distance from a point to a footprint (0 if inside). */
export function distanceToFootprint(f, x, z) {
  if (f.kind === 'circle') return Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r);
  const dx = Math.max(0, Math.abs(x - f.x) - f.hw);
  const dz = Math.max(0, Math.abs(z - f.z) - f.hd);
  return Math.hypot(dx, dz);
}

/** Edge-to-edge horizontal gap between two footprints (negative/zero when overlapping). */
export function footprintGap(a, b) {
  if (a.kind === 'circle' && b.kind === 'circle') {
    return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  }
  if (a.kind === 'rect' && b.kind === 'rect') {
    const dx = Math.max(0, Math.abs(a.x - b.x) - a.hw - b.hw);
    const dz = Math.max(0, Math.abs(a.z - b.z) - a.hd - b.hd);
    return Math.hypot(dx, dz);
  }
  const c = a.kind === 'circle' ? a : b;
  const r = a.kind === 'rect' ? a : b;
  return distanceToFootprint(r, c.x, c.z) - c.r;
}

/** Sampled positions of a platform over its motion cycle. */
export function samplePositions(p, samples = 24) {
  if (p.type !== 'mover') return [p.pos];
  const out = [];
  for (let i = 0; i < samples; i++) out.push(platformPositionAt(p, (i / samples) * p.period, [0, 0, 0]));
  return out;
}
