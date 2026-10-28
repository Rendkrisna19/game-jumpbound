import { MeshStandardMaterial, MeshBasicMaterial, Color } from 'three';

// Shared material cache: identical looks reuse a single material instance across the scene.
const cache = new Map();

/**
 * @param {string} color hex colour
 * @param {object} opts { flat, emissive, emissiveIntensity, roughness, metalness, transparent, opacity }
 */
export function getMaterial(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  let m = cache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color: new Color(color),
      flatShading: opts.flat ?? true,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0,
      emissive: new Color(opts.emissive ?? '#000000'),
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.depthWrite ?? true,
    });
    cache.set(key, m);
  }
  return m;
}

export function getBasicMaterial(color, opts = {}) {
  const key = `basic|${color}|${JSON.stringify(opts)}`;
  let m = cache.get(key);
  if (!m) {
    m = new MeshBasicMaterial({
      color: new Color(color),
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.depthWrite ?? true,
      fog: opts.fog ?? true,
      toneMapped: opts.toneMapped ?? true,
    });
    cache.set(key, m);
  }
  return m;
}
