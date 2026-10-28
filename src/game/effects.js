// Fire-and-forget particle requests, drained by the <Effects /> renderer.
export const effectQueue = [];

/**
 * @param {number[]|{x,y,z}} pos
 * @param {object} opts color, count, speed, size, life, gravity, up, spread
 */
export function spawnBurst(pos, opts = {}) {
  const p = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
  effectQueue.push({ pos: p, ...opts });
  if (effectQueue.length > 64) effectQueue.shift();
}
