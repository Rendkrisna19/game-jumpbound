// Analytic shape tests used for gameplay triggers (enemies, hazards, pickups).
// The player is a vertical capsule: a segment from (x, y - hh, z) to (x, y + hh, z) inflated by r.
// All functions are allocation-free so they can run every frame.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Distance between two 1D intervals (0 if overlapping). */
function intervalGap(aMin, aMax, bMin, bMax) {
  if (aMax < bMin) return bMin - aMax;
  if (bMax < aMin) return aMin - bMax;
  return 0;
}

/** Capsule vs sphere overlap. */
export function capsuleSphere(cap, sx, sy, sz, sr) {
  const cy = clamp(sy, cap.y - cap.hh, cap.y + cap.hh);
  const dx = sx - cap.x;
  const dy = sy - cy;
  const dz = sz - cap.z;
  const rr = cap.r + sr;
  return dx * dx + dy * dy + dz * dz <= rr * rr;
}

/** Capsule vs axis-aligned box overlap (exact for a vertical capsule). */
export function capsuleAabb(cap, minX, minY, minZ, maxX, maxY, maxZ) {
  const dx = cap.x < minX ? minX - cap.x : cap.x > maxX ? cap.x - maxX : 0;
  const dz = cap.z < minZ ? minZ - cap.z : cap.z > maxZ ? cap.z - maxZ : 0;
  const dy = intervalGap(cap.y - cap.hh, cap.y + cap.hh, minY, maxY);
  return dx * dx + dy * dy + dz * dz <= cap.r * cap.r;
}

/** Capsule vs vertical cylinder (centre at base, height h). */
export function capsuleCylinder(cap, cx, baseY, cz, radius, height) {
  const dx = cap.x - cx;
  const dz = cap.z - cz;
  const horiz = Math.max(0, Math.sqrt(dx * dx + dz * dz) - radius);
  const dy = intervalGap(cap.y - cap.hh, cap.y + cap.hh, baseY, baseY + height);
  return horiz * horiz + dy * dy <= cap.r * cap.r;
}

/**
 * Squared distance between segments P1Q1 and P2Q2 (Ericson, Real-Time Collision Detection 5.1.9).
 * Arguments are flat numbers to avoid allocations.
 */
export function segmentSegmentDistSq(
  p1x, p1y, p1z, q1x, q1y, q1z,
  p2x, p2y, p2z, q2x, q2y, q2z,
) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z;
  const d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const EPS = 1e-9;
  let s;
  let t;
  if (a <= EPS && e <= EPS) {
    s = t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const cx = p1x + d1x * s - (p2x + d2x * t);
  const cy = p1y + d1y * s - (p2y + d2y * t);
  const cz = p1z + d1z * s - (p2z + d2z * t);
  return cx * cx + cy * cy + cz * cz;
}

/** Capsule vs capsule-shaped bar (segment A-B with radius br). */
export function capsuleSegment(cap, ax, ay, az, bx, by, bz, br) {
  const d2 = segmentSegmentDistSq(
    cap.x, cap.y - cap.hh, cap.z, cap.x, cap.y + cap.hh, cap.z,
    ax, ay, az, bx, by, bz,
  );
  const rr = cap.r + br;
  return d2 <= rr * rr;
}

/** True when the capsule's feet are above `topY` and it is moving downward: a stomp. */
export function isStomp(cap, vy, topY, tolerance = 0.25) {
  return vy <= 0.5 && cap.y - cap.hh - cap.r >= topY - tolerance;
}
