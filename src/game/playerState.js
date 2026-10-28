import { Vector3 } from 'three';
import { PLAYER } from './constants';

// High-frequency player data shared between systems via plain mutation (no React state).
export const playerState = {
  position: new Vector3(),
  velocity: new Vector3(),
  grounded: false,
  facing: 0,
  sprinting: false,
  dead: false,
  deathReason: null,
  celebrating: false,
  invulnerableUntil: 0,
  /** Set to true to make the camera snap to the player on the next frame. */
  snapCamera: true,
  /** Last time (game clock) the player landed and how hard (fall speed). */
  landedAt: -10,
  landSpeed: 0,
  hurtAt: -10,
  stompAt: -10,
  jumpedAt: -10,
  /** Capsule descriptor reused by collision tests (kept in sync with position). */
  capsule: { x: 0, y: 0, z: 0, hh: PLAYER.halfHeight, r: PLAYER.radius },
};

/** Camera yaw shared with the player for camera-relative movement. */
export const cameraState = { yaw: 0, trauma: 0 };

/** Imperative API implemented by the Player component. */
export const playerApi = {
  hurt: () => {},
  bounce: () => {},
  reachPortal: () => {},
  respawnAtCheckpoint: () => {},
  teleport: () => {},
};

export function isInvulnerable(now) {
  return playerState.dead || playerState.celebrating || now < playerState.invulnerableUntil;
}

export function addCameraTrauma(amount) {
  cameraState.trauma = Math.min(1, cameraState.trauma + amount);
}
