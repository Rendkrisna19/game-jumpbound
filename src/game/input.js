// Global input state. Written by DOM listeners / touch controls, read inside the render loop.
// Nothing here triggers React renders.

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyQ: 'camLeft', KeyE: 'camRight',
};

const held = {
  forward: false, back: false, left: false, right: false,
  jump: false, sprint: false, camLeft: false, camRight: false,
};

export const input = {
  held,
  /** Touch joystick vector in [-1, 1] (x = right, y = forward). */
  touch: { x: 0, y: 0, active: false },
  touchJump: false,
  touchSprint: false,
  /** Timestamp (performance.now) of the latest unconsumed jump press. */
  jumpPressedAt: -Infinity,
  /** Accumulated camera look deltas from mouse / touch drag (pixels). */
  lookX: 0,
  lookY: 0,
  zoom: 0,
};

export function pressJump() {
  input.jumpPressedAt = performance.now();
}

/**
 * Returns true (once) if jump was pressed after `sinceMs` (a performance.now timestamp).
 * Callers pass the previous frame's time, so a press is never lost to a long frame hitch.
 */
export function consumeJump(sinceMs) {
  if (input.jumpPressedAt >= sinceMs) {
    input.jumpPressedAt = -Infinity;
    return true;
  }
  return false;
}

export function isJumpHeld() {
  return held.jump || input.touchJump;
}

export function isSprintHeld() {
  return held.sprint || input.touchSprint;
}

/** Movement intent: x = strafe right, y = forward. Length clamped to 1. */
export function getMoveVector(out) {
  let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  let y = (held.forward ? 1 : 0) - (held.back ? 1 : 0);
  if (input.touch.active) {
    x += input.touch.x;
    y += input.touch.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  out.x = x;
  out.y = y;
  return out;
}

export function resetInput() {
  for (const k of Object.keys(held)) held[k] = false;
  input.touch.x = input.touch.y = 0;
  input.touch.active = false;
  input.touchJump = input.touchSprint = false;
  input.jumpPressedAt = -Infinity;
  input.lookX = input.lookY = input.zoom = 0;
}

let attached = false;

/**
 * Attach keyboard listeners. `onAction` receives discrete actions ('pause', 'restartCheckpoint').
 * Returns a detach function.
 */
export function attachKeyboard(onAction, isGameplayActive) {
  if (attached) return () => {};
  attached = true;

  const down = (e) => {
    const action = KEY_MAP[e.code];
    const active = isGameplayActive();
    if (action) {
      if (active) e.preventDefault();
      if (action === 'jump' && !e.repeat && !held.jump) pressJump();
      held[action] = true;
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') onAction('pause');
    else if (e.code === 'KeyR') onAction('restartCheckpoint');
  };
  const up = (e) => {
    const action = KEY_MAP[e.code];
    if (action) held[action] = false;
  };
  const blur = () => {
    resetInput();
    onAction('blur');
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    attached = false;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}
