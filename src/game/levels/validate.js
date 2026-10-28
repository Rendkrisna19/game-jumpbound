// Static level validation: proves that every jump on every declared route is inside the
// player's physical jump envelope, and that gameplay objects sit on real surfaces.
import { PLAYER, jumpEnvelope, airtime } from '../constants.js';
import { footprint, footprintGap, samplePositions, distanceToFootprint, platformDepth } from './geometry.js';

const SAFETY = 0.8; // only 80% of theoretical reach counts as achievable
const CLEARANCE = 0.3; // feet must clear the target edge by this much
const STEP_HEIGHT = 0.35; // autostep height of the character controller

export function analyseJump(from, to, { sprint = false } = {}) {
  const launch = from.bounce || PLAYER.jumpVelocity;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const { maxHeight } = jumpEnvelope(launch);
  let best = null;
  for (const a of samplePositions(from)) {
    for (const b of samplePositions(to)) {
      const gap = footprintGap(footprint(from, a[0], a[2]), footprint(to, b[0], b[2]));
      const dh = b[1] - a[1];
      let ok;
      let reach = 0;
      if (gap <= 0.05 && dh <= STEP_HEIGHT) {
        ok = true; // walk across (or drop down)
      } else if (dh > maxHeight - CLEARANCE) {
        ok = false;
      } else {
        reach = speed * airtime(dh, launch) * SAFETY;
        ok = gap <= reach;
      }
      const margin = ok ? reach - gap : -Infinity;
      if (!best || (ok && (!best.ok || margin > best.margin))) best = { ok, gap, dh, reach, margin };
    }
  }
  return best;
}

function onSurface(level, pos, { minAbove = -0.05, maxAbove = 0.05, inset = 0 } = {}) {
  return level.platforms.some((p) =>
    samplePositions(p).some((c) => {
      const f = footprint(p, c[0], c[2]);
      const inside = distanceToFootprint(f, pos[0], pos[2]) <= 0 && insetOk(f, pos, inset);
      const above = pos[1] - c[1];
      return inside && above >= minAbove && above <= maxAbove;
    }),
  );
}

function insetOk(f, pos, inset) {
  if (!inset) return true;
  if (f.kind === 'circle') return Math.hypot(pos[0] - f.x, pos[2] - f.z) <= f.r - inset;
  return Math.abs(pos[0] - f.x) <= f.hw - inset && Math.abs(pos[2] - f.z) <= f.hd - inset;
}

function insideSolid(level, pos) {
  return level.platforms.some((p) => {
    if (p.type === 'mover' || p.type === 'timed') return false;
    const f = footprint(p);
    const top = p.pos[1];
    return distanceToFootprint(f, pos[0], pos[2]) <= 0 && pos[1] < top - 0.1 && pos[1] > top - platformDepth(p);
  });
}

function collectibleReachable(level, pos) {
  return level.platforms.some((p) => {
    const { maxHeight } = jumpEnvelope(p.bounce || PLAYER.jumpVelocity);
    return samplePositions(p).some((c) => {
      const d = distanceToFootprint(footprint(p, c[0], c[2]), pos[0], pos[2]);
      const above = pos[1] - c[1];
      return d <= 3 && above >= 0.2 && above <= maxHeight + 1.5;
    });
  });
}

export function validateLevel(level) {
  const errors = [];
  const byId = new Map();
  for (const p of level.platforms) {
    if (byId.has(p.id)) errors.push(`duplicate platform id "${p.id}"`);
    byId.set(p.id, p);
  }

  for (const route of level.routes) {
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const next = route[i];
      const fromId = typeof prev === 'string' ? prev : prev.id;
      const toId = typeof next === 'string' ? next : next.id;
      const from = byId.get(fromId);
      const to = byId.get(toId);
      if (!from || !to) {
        errors.push(`route references unknown platform ${!from ? fromId : toId}`);
        continue;
      }
      const res = analyseJump(from, to, { sprint: typeof next === 'object' && next.sprint });
      if (!res.ok) {
        errors.push(
          `jump ${fromId} -> ${toId} not achievable (gap ${res.gap.toFixed(2)}, dh ${res.dh.toFixed(2)}, reach ${res.reach.toFixed(2)})`,
        );
      }
    }
  }

  // Every platform must be on at least one route (no unreachable geometry the player is lured to)
  const routed = new Set(level.routes.flat().map((r) => (typeof r === 'string' ? r : r.id)));
  for (const p of level.platforms) {
    if (!routed.has(p.id) && !p.scenery) errors.push(`platform "${p.id}" is not part of any route`);
  }

  if (!onSurface(level, level.spawn)) errors.push('spawn is not on a platform');
  level.checkpoints.forEach((c, i) => {
    if (!onSurface(level, c.pos, { inset: 0.6 })) errors.push(`checkpoint ${i} is not safely on a platform`);
  });
  if (!onSurface(level, level.portal.pos, { inset: 1 })) errors.push('portal is not on a platform');

  level.enemies.forEach((e, i) => {
    if (e.type === 'wanderer') {
      if (!onSurface(level, e.from, { inset: 0.5 }) || !onSurface(level, e.to, { inset: 0.5 })) {
        errors.push(`wanderer ${i} patrol leaves its platform`);
      }
    } else if (e.type === 'guardian') {
      if (!onSurface(level, e.home, { minAbove: 0.8, maxAbove: 2.2 })) errors.push(`guardian ${i} has no platform below`);
    }
  });

  level.hazards.forEach((h, i) => {
    if (!onSurface(level, h.pos)) errors.push(`hazard ${i} (${h.type}) is not on a platform`);
  });

  const items = [
    ...level.crystals.map((p, i) => ({ p, label: `crystal ${i}` })),
    ...level.sunstones.map((p, i) => ({ p, label: `sunstone ${i}` })),
  ];
  for (const { p, label } of items) {
    if (!collectibleReachable(level, p)) errors.push(`${label} at [${p.map((v) => v.toFixed(1))}] is unreachable`);
    if (insideSolid(level, p)) errors.push(`${label} is embedded in geometry`);
  }

  return errors;
}
