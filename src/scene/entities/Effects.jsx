import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, OctahedronGeometry, MeshBasicMaterial } from 'three';
import { effectQueue } from '../../game/effects';
import { useGame } from '../../game/store';

const POOL = 320;

/** Pooled particle bursts rendered with one InstancedMesh (one draw call for all effects). */
export default function Effects() {
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }), POOL);
    m.frustumCulled = false;
    const c = new Color('#ffffff');
    for (let i = 0; i < POOL; i++) m.setColorAt(i, c);
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    },
    [mesh],
  );

  const particles = useMemo(
    () => Array.from({ length: POOL }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, g: 9, rot: 0 })),
    [],
  );
  const state = useMemo(() => ({ cursor: 0, dummy: new Object3D(), color: new Color() }), []);

  useFrame((_, delta) => {
    const paused = useGame.getState().screen === 'paused';
    // Drain spawn requests.
    while (effectQueue.length) {
      const req = effectQueue.shift();
      const count = req.count ?? 10;
      state.color.set(req.color ?? '#ffffff');
      for (let n = 0; n < count; n++) {
        const i = state.cursor;
        state.cursor = (state.cursor + 1) % POOL;
        const p = particles[i];
        const a = Math.random() * Math.PI * 2;
        const sp = (req.speed ?? 3) * (0.4 + Math.random() * 0.8);
        p.alive = true;
        p.x = req.pos[0];
        p.y = req.pos[1];
        p.z = req.pos[2];
        p.vx = Math.cos(a) * sp;
        p.vz = Math.sin(a) * sp;
        p.vy = (req.up ?? 2) * (0.5 + Math.random());
        p.max = p.life = (req.life ?? 0.7) * (0.7 + Math.random() * 0.6);
        p.size = (req.size ?? 0.12) * (0.7 + Math.random() * 0.6);
        p.g = req.gravity ?? 9;
        p.rot = Math.random() * 6;
        mesh.setColorAt(i, state.color);
      }
      mesh.instanceColor.needsUpdate = true;
    }

    const dt = paused ? 0 : Math.min(delta, 0.05);
    const d = state.dummy;
    for (let i = 0; i < POOL; i++) {
      const p = particles[i];
      if (p.alive) {
        p.life -= dt;
        if (p.life <= 0) p.alive = false;
        p.vy -= p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rot += dt * 6;
      }
      const s = p.alive ? p.size * Math.min(1, (p.life / p.max) * 1.6) : 0;
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rot, p.rot * 0.7, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
