import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { Vector3, MathUtils } from 'three';
import { PLAYER, PLAYER_CENTER_OFFSET, GAME } from '../../game/constants';
import { playerState, playerApi, cameraState, isInvulnerable, addCameraTrauma } from '../../game/playerState';
import { consumeJump, getMoveVector, isJumpHeld, isSprintHeld } from '../../game/input';
import { gameClock, MAX_DT } from '../../game/clock';
import { getGame, isPlaying, session } from '../../game/store';
import { surfaceRegistry } from '../../game/registry';
import { spawnBurst } from '../../game/effects';
import { audio } from '../../audio/AudioManager';
import PlayerModel from './PlayerModel';

const UP = { x: 0, y: 1, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Move `v` (x/z) towards target by at most maxDelta. */
function approachXZ(v, tx, tz, maxDelta) {
  const dx = tx - v.x;
  const dz = tz - v.z;
  const len = Math.hypot(dx, dz);
  if (len <= maxDelta || len < 1e-6) {
    v.x = tx;
    v.z = tz;
  } else {
    v.x += (dx / len) * maxDelta;
    v.z += (dz / len) * maxDelta;
  }
}

export default function Player({ level }) {
  const body = useRef(null);
  const collider = useRef(null);
  const visual = useRef(null);
  const controller = useRef(null);
  const { world, rapier } = useRapier();

  const spawnCenter = useMemo(
    () => [level.spawn[0], level.spawn[1] + PLAYER_CENTER_OFFSET + 0.05, level.spawn[2]],
    [level],
  );

  // Mutable controller state (never triggers React renders).
  const st = useMemo(
    () => ({
      pos: new Vector3(...spawnCenter),
      vel: new Vector3(),
      desired: new Vector3(),
      move: { x: 0, y: 0 },
      grounded: true,
      jumping: false,
      coyote: 0,
      jumpBuffer: 0,
      controlLock: 0,
      airTime: 0,
      deathReason: null,
      deathTimer: 0,
      celebrateTimer: 0,
      hintTimer: 0,
      lastFrameAt: 0,
      ray: null,
    }),
    [spawnCenter],
  );

  // ---- character controller lifecycle ----
  useEffect(() => {
    const c = world.createCharacterController(0.02);
    c.setUp(UP);
    c.setSlideEnabled(true);
    c.setMaxSlopeClimbAngle(MathUtils.degToRad(50));
    c.setMinSlopeSlideAngle(MathUtils.degToRad(35));
    c.enableAutostep(0.35, 0.15, false);
    c.enableSnapToGround(0.3);
    c.setApplyImpulsesToDynamicBodies(false);
    controller.current = c;
    st.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { ...DOWN });
    return () => {
      controller.current = null;
      try {
        world.removeCharacterController(c);
      } catch {
        // world already disposed with the Physics provider
      }
    };
  }, [world, rapier, st]);

  // ---- imperative API used by enemies, hazards, portal and the keyboard ----
  useEffect(() => {
    // Initial shared state for a fresh level.
    playerState.position.copy(st.pos);
    playerState.velocity.set(0, 0, 0);
    playerState.dead = false;
    playerState.celebrating = false;
    playerState.invulnerableUntil = 0;
    playerState.snapCamera = true;
    playerState.facing = Math.PI;
    playerState.hurtAt = -10;
    playerState.landedAt = -10;
    cameraState.yaw = level.cameraYaw ?? 0;

    const teleport = (surfacePos, invulnerability) => {
      st.pos.set(surfacePos[0], surfacePos[1] + PLAYER_CENTER_OFFSET + 0.05, surfacePos[2]);
      st.vel.set(0, 0, 0);
      st.grounded = false;
      st.jumping = false;
      st.airTime = 0;
      st.controlLock = 0;
      st.jumpBuffer = 0;
      body.current?.setTranslation(st.pos, true);
      body.current?.setNextKinematicTranslation(st.pos);
      playerState.dead = false;
      playerState.position.copy(st.pos);
      playerState.velocity.set(0, 0, 0);
      playerState.invulnerableUntil = gameClock.time + invulnerability;
      playerState.snapCamera = true;
      spawnBurst([st.pos.x, st.pos.y - 0.4, st.pos.z], { color: '#bff7ff', count: 18, speed: 3, up: 2 });
    };

    const respawnPoint = () => session.checkpoint?.pos ?? level.spawn;

    playerApi.teleport = (pos) => teleport(pos, 0.5);

    playerApi.respawnAtCheckpoint = () => {
      if (playerState.dead || playerState.celebrating || !isPlaying()) return;
      teleport(respawnPoint(), 1.2);
      audio.play('menuClose');
    };

    playerApi.die = (reason) => {
      if (playerState.dead || playerState.celebrating) return;
      playerState.dead = true;
      playerState.deathReason = reason;
      st.deathReason = reason;
      st.deathTimer = GAME.deathDelay;
      audio.play('lifeLost');
      if (reason !== 'fall') {
        spawnBurst(st.pos, { color: '#ff8a5c', count: 26, speed: 5, up: 3 });
        st.vel.set(0, 0, 0);
      }
    };

    playerApi.finishDeath = () => {
      const canRespawn = getGame().loseLife();
      if (canRespawn) teleport(respawnPoint(), PLAYER.respawnInvulnerability);
    };

    playerApi.hurt = (from, { force = 1 } = {}) => {
      const now = gameClock.time;
      if (isInvulnerable(now) || !isPlaying()) return false;
      const remaining = getGame().damage();
      playerState.hurtAt = now;
      addCameraTrauma(0.5);
      audio.play('hurt');
      spawnBurst(st.pos, { color: '#ff5d6c', count: 14, speed: 4, up: 2 });
      if (remaining <= 0) {
        playerApi.die('hurt');
        return true;
      }
      playerState.invulnerableUntil = now + PLAYER.hurtInvulnerability;
      let dx = st.pos.x - (from?.x ?? st.pos.x);
      let dz = st.pos.z - (from?.z ?? st.pos.z);
      const len = Math.hypot(dx, dz);
      if (len < 0.01) {
        dx = -Math.sin(playerState.facing);
        dz = -Math.cos(playerState.facing);
      } else {
        dx /= len;
        dz /= len;
      }
      st.vel.set(dx * PLAYER.knockback * force, PLAYER.knockbackUp, dz * PLAYER.knockback * force);
      st.controlLock = PLAYER.knockbackControlLock;
      st.grounded = false;
      st.jumping = false;
      return true;
    };

    playerApi.bounce = (strength) => {
      st.vel.y = strength ?? (isJumpHeld() ? PLAYER.stompBounceHeld : PLAYER.stompBounce);
      st.grounded = false;
      st.jumping = false;
      st.coyote = 0;
      st.jumpBuffer = 0;
      playerState.stompAt = gameClock.time;
    };

    playerApi.reachPortal = () => {
      if (playerState.celebrating || playerState.dead) return;
      playerState.celebrating = true;
      st.celebrateTimer = GAME.portalCelebration;
      st.vel.x = 0;
      st.vel.z = 0;
      audio.play('portal');
    };

    return () => {
      for (const k of Object.keys(playerApi)) playerApi[k] = () => {};
    };
  }, [level, st]);

  // ---- per-frame simulation ----
  useFrame((_, delta) => {
    const rb = body.current;
    const col = collider.current;
    const ctrl = controller.current;
    if (!rb || !col || !ctrl || !isPlaying()) return;
    const dt = Math.min(delta, MAX_DT);
    const now = gameClock.time;

    // --- dead: let the body fall (void) or stay put (defeated), then respawn ---
    if (playerState.dead) {
      if (st.deathReason === 'fall') {
        st.vel.y = Math.max(st.vel.y - PLAYER.gravity * dt, -PLAYER.maxFallSpeed);
        st.pos.addScaledVector(st.vel, dt);
      }
      st.deathTimer -= dt;
      playerState.position.copy(st.pos);
      if (visual.current) visual.current.position.copy(st.pos);
      if (st.deathTimer <= 0) playerApi.finishDeath();
      return;
    }

    // --- celebration at the portal ---
    if (playerState.celebrating) {
      st.celebrateTimer -= dt;
      if (st.celebrateTimer <= 0 && getGame().screen === 'playing') {
        audio.play('victory');
        getGame().completeLevel();
      }
    }

    // --- input ---
    st.jumpBuffer = Math.max(0, st.jumpBuffer - dt);
    const frameNow = performance.now();
    if (consumeJump(Math.max(frameNow - 600, Math.min(st.lastFrameAt, frameNow - 150) - 50)) && !playerState.celebrating) st.jumpBuffer = PLAYER.jumpBuffer;
    st.lastFrameAt = frameNow;
    st.controlLock -= dt;

    const mv = getMoveVector(st.move);
    if (playerState.celebrating) mv.x = mv.y = 0;
    const yaw = cameraState.yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wx = mv.x * cos - mv.y * sin;
    const wz = -mv.x * sin - mv.y * cos;
    const inputMag = Math.min(1, Math.hypot(wx, wz));
    const sprinting = isSprintHeld() && inputMag > 0.1;
    const maxSpeed = (sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * inputMag;
    const dirLen = inputMag > 1e-4 ? Math.hypot(wx, wz) : 1;
    const tx = inputMag > 1e-4 ? (wx / dirLen) * maxSpeed : 0;
    const tz = inputMag > 1e-4 ? (wz / dirLen) * maxSpeed : 0;
    const hasInput = inputMag > 0.05;

    if (st.controlLock <= 0) {
      const accel = st.grounded
        ? hasInput ? PLAYER.groundAccel : PLAYER.groundDecel
        : hasInput ? PLAYER.airAccel : PLAYER.airDecel;
      approachXZ(st.vel, tx, tz, accel * dt);
    }

    // --- jumping (coyote time + jump buffer, single jump only) ---
    st.coyote = st.grounded ? PLAYER.coyoteTime : st.coyote - dt;
    if (st.jumpBuffer > 0 && st.coyote > 0) {
      st.vel.y = PLAYER.jumpVelocity;
      st.jumpBuffer = 0;
      st.coyote = 0;
      st.grounded = false;
      st.jumping = true;
      playerState.jumpedAt = now;
      audio.play('jump');
    }

    // --- gravity ---
    if (!st.grounded) {
      let g = PLAYER.gravity;
      if (st.vel.y < 0) g *= PLAYER.fallMultiplier;
      else if (st.jumping && !isJumpHeld()) g *= PLAYER.lowJumpMultiplier;
      st.vel.y = Math.max(st.vel.y - g * dt, -PLAYER.maxFallSpeed);
      st.airTime += dt;
    } else {
      st.vel.y = -1.5; // keep contact with the ground
    }

    // --- collide & slide through the Rapier character controller ---
    st.desired.set(st.vel.x * dt, st.vel.y * dt, st.vel.z * dt);
    ctrl.computeColliderMovement(col, st.desired, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = ctrl.computedMovement();
    let groundedNow = ctrl.computedGrounded() && st.vel.y <= 0;

    // bonk on ceilings; stop pushing into walls
    if (st.vel.y > 0 && m.y < st.desired.y * 0.5) st.vel.y = 0;
    if (Math.abs(st.desired.x) > 1e-5 && Math.abs(m.x) < Math.abs(st.desired.x) * 0.5) st.vel.x = m.x / dt;
    if (Math.abs(st.desired.z) > 1e-5 && Math.abs(m.z) < Math.abs(st.desired.z) * 0.5) st.vel.z = m.z / dt;

    st.pos.x += m.x;
    st.pos.y += m.y;
    st.pos.z += m.z;

    // --- what are we standing on? (moving platforms carry, bounce pads launch) ---
    let surface = null;
    if (groundedNow || st.grounded) {
      st.ray.origin.x = st.pos.x;
      st.ray.origin.y = st.pos.y;
      st.ray.origin.z = st.pos.z;
      const hit = world.castRay(st.ray, PLAYER_CENTER_OFFSET + 0.35, true, undefined, undefined, col);
      if (hit) {
        surface = surfaceRegistry.get(hit.collider.handle) ?? null;
        if (!groundedNow && hit.timeOfImpact <= PLAYER_CENTER_OFFSET + 0.08 && st.vel.y <= 0) groundedNow = true;
      }
    }

    if (groundedNow && !st.grounded) {
      const impact = -st.vel.y;
      if (surface?.bounce) {
        st.vel.y = surface.bounce;
        groundedNow = false;
        st.jumping = false;
        surface.bouncedAt = now;
        audio.play('bounce');
        spawnBurst([st.pos.x, st.pos.y - PLAYER_CENTER_OFFSET, st.pos.z], { color: '#fff27a', count: 12, speed: 3, up: 3 });
      } else if (st.airTime > 0.12) {
        playerState.landedAt = now;
        playerState.landSpeed = impact;
        if (impact > 6) {
          audio.play('land', { volume: Math.min(1, impact / 22) });
          spawnBurst([st.pos.x, st.pos.y - PLAYER_CENTER_OFFSET + 0.05, st.pos.z], {
            color: '#f4efe3', count: Math.min(12, Math.round(impact / 2)), speed: 2.2, up: 1, gravity: 4, size: 0.12,
          });
        }
        if (impact > 20) addCameraTrauma(0.18);
      }
    }
    if (groundedNow) {
      st.grounded = true;
      st.jumping = false;
      st.airTime = 0;
    } else {
      st.grounded = false;
    }

    if (surface && st.grounded) st.pos.add(surface.delta);

    rb.setNextKinematicTranslation(st.pos);

    // --- facing ---
    const hSpeed = Math.hypot(st.vel.x, st.vel.z);
    if (playerState.celebrating) {
      playerState.facing = lerpAngle(playerState.facing, yaw, 1 - Math.exp(-6 * dt));
    } else if (hSpeed > 0.4 && st.controlLock <= 0) {
      const target = Math.atan2(st.vel.x, st.vel.z);
      playerState.facing = lerpAngle(playerState.facing, target, 1 - Math.exp(-PLAYER.turnSpeed * dt));
    }

    // --- publish shared state ---
    playerState.position.copy(st.pos);
    playerState.velocity.copy(st.vel);
    playerState.grounded = st.grounded;
    playerState.sprinting = sprinting && st.grounded;
    const c = playerState.capsule;
    c.x = st.pos.x;
    c.y = st.pos.y;
    c.z = st.pos.z;
    if (visual.current) visual.current.position.copy(st.pos);

    // --- falling out of the world ---
    if (st.pos.y < level.killY) playerApi.die('fall');

    // --- contextual hints (throttled) ---
    st.hintTimer -= dt;
    if (st.hintTimer <= 0) {
      st.hintTimer = 0.2;
      const feetY = st.pos.y - PLAYER_CENTER_OFFSET;
      let hint = null;
      for (const h of level.hints ?? []) {
        if (Math.hypot(st.pos.x - h.pos[0], st.pos.z - h.pos[2]) < h.radius && Math.abs(feetY - h.pos[1]) < 2.5) {
          hint = h.text;
          break;
        }
      }
      getGame().setHint(hint);
    }
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={spawnCenter}>
        <CapsuleCollider ref={collider} args={[PLAYER.halfHeight, PLAYER.radius]} />
      </RigidBody>
      <group ref={visual} position={spawnCenter}>
        <PlayerModel />
      </group>
    </>
  );
}
