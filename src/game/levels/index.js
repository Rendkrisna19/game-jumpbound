import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';

/** Ordered list of stages. Add a new config file and append it here to create a new level. */
export const LEVELS = [level1, level2, level3];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}
