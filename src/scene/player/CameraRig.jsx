import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { Vector3 } from 'three';
import { playerState, cameraState } from '../../game/playerState';
import { input } from '../../game/input';
import { useGame } from '../../game/store';

const MIN_PITCH = 0.08;
const MAX_PITCH = 1.15;
const MIN_DIST = 5.5;
const MAX_DIST = 14;

/**
 * Third-person follow camera:
 *  - smooth (frame-rate independent) follow with gentle vertical damping during jumps
 *  - look-ahead in the movement direction so the next platform stays visible
 *  - orbit by mouse drag / touch drag / Q & E, zoom with the wheel
 *  - ray-cast against static geometry so it never clips into terrain
 *  - optional trauma-based shake (respects the settings toggle)
 */
export default function CameraRig({ level }) {
  const { camera, gl } = useThree();
  const { world, rapier } = useRapier();

  const st = useMemo(
    () => ({
      pitch: 0.36,
      dist: 9.5,
      curDist: 9.5,
      focus: new Vector3(),
      look: new Vector3(),
      ahead: new Vector3(),
      desired: new Vector3(),
      dir: new Vector3(),
      groundY: 0,
      ray: null,
    }),
    [],
  );

  useEffect(() => {
    cameraState.yaw = level.cameraYaw ?? 0;
    st.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  }, [level, rapier, st]);

  // Pointer drag & wheel on the canvas.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId = null;
    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      input.lookX += e.clientX - lastX;
      input.lookY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e) => {
      if (e.pointerId === pointerId) dragging = false;
    };
    const wheel = (e) => {
      input.zoom += Math.sign(e.deltaY);
    };
    const ctx = (e) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: true });
    el.addEventListener('contextmenu', ctx);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('contextmenu', ctx);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const { screen, settings } = useGame.getState();
    const dt = Math.min(delta, 0.05);
    const p = playerState.position;
    const active = screen === 'playing';

    // ---- orbit input ----
    if (active) {
      const sens = settings.mouseSensitivity;
      cameraState.yaw -= input.lookX * 0.0055 * sens;
      st.pitch += input.lookY * 0.004 * sens * (settings.invertY ? -1 : 1);
      if (input.held.camLeft) cameraState.yaw += 2.2 * dt;
      if (input.held.camRight) cameraState.yaw -= 2.2 * dt;
      st.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, st.pitch));
      st.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, st.dist + input.zoom * 0.8));
    }
    input.lookX = input.lookY = input.zoom = 0;

    // ---- follow target ----
    if (playerState.snapCamera) {
      st.focus.set(p.x, p.y + 0.6, p.z);
      st.groundY = p.y;
      st.ahead.set(0, 0, 0);
      st.curDist = st.dist;
      playerState.snapCamera = false;
    } else if (!playerState.dead) {
      // Look ahead in the movement direction.
      const v = playerState.velocity;
      st.ahead.x += (v.x * 0.22 - st.ahead.x) * (1 - Math.exp(-2.5 * dt));
      st.ahead.z += (v.z * 0.22 - st.ahead.z) * (1 - Math.exp(-2.5 * dt));

      // Vertical framing: follow the ground height, not every bump of a jump,
      // unless the player rises far above or drops below the framing band.
      if (playerState.grounded) st.groundY = p.y;
      const above = p.y - st.groundY;
      let targetY = st.groundY + Math.max(0, above - 1.8);
      if (p.y < st.groundY - 0.5) targetY = p.y;
      const ky = p.y < st.groundY - 0.5 ? 9 : playerState.grounded ? 5 : 2.5;
      const kh = 9;
      st.focus.x += (p.x + st.ahead.x - st.focus.x) * (1 - Math.exp(-kh * dt));
      st.focus.z += (p.z + st.ahead.z - st.focus.z) * (1 - Math.exp(-kh * dt));
      st.focus.y += (targetY + 0.6 - st.focus.y) * (1 - Math.exp(-ky * dt));
    }

    // ---- desired position on the orbit sphere ----
    const yaw = cameraState.yaw;
    const cp = Math.cos(st.pitch);
    st.dir.set(Math.sin(yaw) * cp, Math.sin(st.pitch), Math.cos(yaw) * cp);

    // ---- terrain collision ----
    let allowed = st.dist;
    if (st.ray) {
      st.ray.origin.x = st.focus.x;
      st.ray.origin.y = st.focus.y + 0.3;
      st.ray.origin.z = st.focus.z;
      st.ray.dir.x = st.dir.x;
      st.ray.dir.y = st.dir.y;
      st.ray.dir.z = st.dir.z;
      const hit = world.castRay(
        st.ray,
        st.dist,
        false,
        rapier.QueryFilterFlags.EXCLUDE_KINEMATIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      );
      if (hit) allowed = Math.max(2.2, hit.timeOfImpact - 0.35);
    }
    const kd = allowed < st.curDist ? 14 : 2.5;
    st.curDist += (allowed - st.curDist) * (1 - Math.exp(-kd * dt));

    st.desired.copy(st.focus).addScaledVector(st.dir, st.curDist);
    st.look.copy(st.focus);
    st.look.y += 0.25;

    // ---- shake ----
    if (cameraState.trauma > 0) {
      if (settings.cameraShake && active) {
        const s = cameraState.trauma * cameraState.trauma * 0.35;
        const t = state.clock.elapsedTime * 40;
        st.desired.x += Math.sin(t * 1.3) * s;
        st.desired.y += Math.sin(t * 1.7 + 1) * s;
        st.desired.z += Math.sin(t * 1.1 + 2) * s;
      }
      cameraState.trauma = Math.max(0, cameraState.trauma - dt * 1.6);
    }

    camera.position.copy(st.desired);
    camera.lookAt(st.look);
  });

  return null;
}
