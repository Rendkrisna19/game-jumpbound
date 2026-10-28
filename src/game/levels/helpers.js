// Helpers for laying out collectibles. Positions are [x, surfaceY, z]; collectibles hover above.
export const HOVER = 0.9;

const lerp = (a, b, t) => a + (b - a) * t;

/** n points evenly spaced from a to b (inclusive), hovering above the surface. */
export function line(a, b, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + HOVER, lerp(a[2], b[2], t)]);
  }
  return out;
}

/** n points along a jump arc between a and b (endpoints excluded). */
export function arc(a, b, n, height = 1.4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const y = lerp(a[1], b[1], t) + HOVER + 4 * height * t * (1 - t);
    out.push([lerp(a[0], b[0], t), y, lerp(a[2], b[2], t)]);
  }
  return out;
}

/** n points in a ring around a centre. */
export function ring(center, radius, n, startAngle = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = startAngle + (i / n) * Math.PI * 2;
    out.push([center[0] + Math.cos(a) * radius, center[1] + HOVER, center[2] + Math.sin(a) * radius]);
  }
  return out;
}

/** A single hovering point above a surface position. */
export function at(p, extra = 0) {
  return [p[0], p[1] + HOVER + extra, p[2]];
}
