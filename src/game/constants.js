// Shared gameplay tunables. Pure data — safe to import from Node tests.

export const PLAYER = {
  // Collision capsule (vertical). Total height = 2 * (halfHeight + radius) = 1.6
  radius: 0.38,
  halfHeight: 0.42,

  walkSpeed: 6.5,
  sprintSpeed: 10,
  groundAccel: 60,
  groundDecel: 50,
  airAccel: 26,
  airDecel: 6,
  turnSpeed: 14,

  jumpVelocity: 12.5,
  gravity: 32,
  fallMultiplier: 1.4, // heavier gravity while falling = snappier arcs
  lowJumpMultiplier: 2.4, // extra gravity when jump is released early (variable jump height)
  maxFallSpeed: 38,

  coyoteTime: 0.12,
  jumpBuffer: 0.14,

  stompBounce: 10,
  stompBounceHeld: 13.5,

  hurtInvulnerability: 1.4,
  respawnInvulnerability: 2.2,
  knockback: 7.5,
  knockbackUp: 7,
  knockbackControlLock: 0.32,
};

/** Height of the capsule centre above the feet. */
export const PLAYER_CENTER_OFFSET = PLAYER.halfHeight + PLAYER.radius;

export const GAME = {
  maxHealth: 3,
  startLives: 3,
  deathDelay: 1.15,
  portalCelebration: 2.2,
};

export const SCORE = {
  crystal: 10,
  sunstone: 250,
  wanderer: 50,
  guardian: 150,
  completion: 1000,
  perfectBonus: 500,
  timeBonusPerSecond: 15,
};

/** Physically derived jump envelope, used by the level validator and docs. */
export function jumpEnvelope(launchVelocity = PLAYER.jumpVelocity) {
  const g = PLAYER.gravity;
  const maxHeight = (launchVelocity * launchVelocity) / (2 * g);
  const timeToApex = launchVelocity / g;
  return { maxHeight, timeToApex };
}

/** Airtime of a jump that lands on a surface `dh` higher than take-off (dh may be negative). */
export function airtime(dh, launchVelocity = PLAYER.jumpVelocity) {
  const { maxHeight, timeToApex } = jumpEnvelope(launchVelocity);
  if (dh > maxHeight) return 0;
  const fallG = PLAYER.gravity * PLAYER.fallMultiplier;
  return timeToApex + Math.sqrt((2 * (maxHeight - dh)) / fallG);
}
