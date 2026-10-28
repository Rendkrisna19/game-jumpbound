import { Vector3 } from 'three';

/**
 * Maps Rapier collider handles to gameplay info about a surface:
 *  - velocity: per-second motion of a moving platform (used to carry the player)
 *  - delta:    translation the platform will apply this frame
 *  - bounce:   launch velocity for bounce pads
 */
export const surfaceRegistry = new Map();

export function registerSurface(handle, info) {
  const entry = { handle, velocity: new Vector3(), delta: new Vector3(), bounce: 0, bouncedAt: -10, ...info };
  surfaceRegistry.set(handle, entry);
  return entry;
}

export function unregisterSurface(handle) {
  surfaceRegistry.delete(handle);
}
