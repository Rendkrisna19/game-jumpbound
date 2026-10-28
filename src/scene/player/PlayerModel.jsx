import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { playerState } from '../../game/playerState';
import { gameClock } from '../../game/clock';
import { useGame } from '../../game/store';
import { getMaterial } from '../materials';
import { getCharacter } from '../../game/characters';

// Procedural heroes (see game/characters.js). Built entirely from primitives and animated
// procedurally, so a character can later be swapped for a rigged GLB by replacing this component
// (the controller only positions the parent group).

/** Materials for a character (getMaterial caches them, so switching is cheap). */
function buildMaterials(c) {
  const soft = (color, roughness = 0.75) => getMaterial(color, { flat: false, roughness });
  return {
    skin: soft(c.skin, 0.7),
    hair: soft(c.hair, 0.8),
    brow: soft(c.hair, 0.8),
    cheek: soft('#ff9d9d', 0.8),
    tunic: soft(c.tunic),
    tunicDark: soft(c.tunicDark, 0.8),
    pants: soft(c.pants, 0.8),
    boot: soft(c.boot, 0.7),
    cap: soft(c.hat, 0.6),
    capDark: soft(c.hatDark, 0.6),
    glass: getMaterial(c.hat, { flat: false, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
    plume: getMaterial(c.accent, { flat: true, roughness: 0.6 }),
    star: getMaterial(c.accent, { flat: true, roughness: 0.4, emissive: c.accent, emissiveIntensity: 0.8 }),
    scarf: soft(c.scarf, 0.8),
    pack: soft(c.pack, 0.85),
    roll: soft(c.roll, 0.85),
    belt: soft('#5b3a22', 0.8),
    gold: getMaterial('#ffd75a', { flat: false, roughness: 0.3, metalness: 0.6 }),
    brass: getMaterial(c.accent, { flat: false, roughness: 0.3, metalness: 0.6 }),
    lens: getMaterial('#7fe8ff', { flat: false, roughness: 0.15, emissive: '#2aa9c9', emissiveIntensity: 0.6 }),
    eye: soft('#1e1b2e', 0.3),
    white: soft('#ffffff', 0.3),
  };
}

// Headwear sits above the forehead. The eyes and brows sit at y ≈ -0.05 … 0.08 on the face, so every
// hat's lower edge stays at or above y ≈ 0.09 to keep the face readable.

/** Wren: aviator cap with ear flaps, goggles and a violet plume. */
function AviatorHat({ M }) {
  return (
    <>
      <mesh material={M.cap} position={[0, 0.09, -0.01]} castShadow>
        <sphereGeometry args={[0.365, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={M.capDark} position={[0, 0.1, 0.26]} rotation={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 14, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh material={M.capDark} position={[-0.33, -0.06, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.07, 0.24, 0.18]} />
      </mesh>
      <mesh material={M.capDark} position={[0.33, -0.06, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.07, 0.24, 0.18]} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <group key={x} position={[x, 0.33, 0.27]} rotation={[-0.5, 0, 0]}>
          <mesh material={M.gold}>
            <torusGeometry args={[0.075, 0.022, 6, 14]} />
          </mesh>
          <mesh material={M.lens} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.02, 12]} />
          </mesh>
        </group>
      ))}
      <mesh material={M.plume} position={[0.12, 0.5, -0.12]} rotation={[-0.6, 0, -0.25]}>
        <coneGeometry args={[0.07, 0.42, 5]} />
      </mesh>
      <mesh material={M.plume} position={[0.2, 0.44, -0.18]} rotation={[-0.9, 0, -0.6]}>
        <coneGeometry args={[0.05, 0.3, 5]} />
      </mesh>
    </>
  );
}

/** Kiko: rounded hood with two fox ears. The hood is open at the front so the face shows. */
function FoxHood({ M }) {
  return (
    <>
      <mesh material={M.cap} position={[0, 0.02, -0.03]} scale={[1, 1, 1.05]} castShadow>
        <sphereGeometry args={[0.375, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.2, 0.36, -0.02]} rotation={[0, 0, -side * 0.35]}>
          <mesh material={M.cap} castShadow>
            <coneGeometry args={[0.12, 0.3, 4]} />
          </mesh>
          <mesh material={M.plume} position={[0, -0.02, 0.05]} scale={[0.6, 0.7, 0.4]}>
            <coneGeometry args={[0.12, 0.3, 4]} />
          </mesh>
        </group>
      ))}
      <mesh material={M.capDark} position={[0, -0.12, -0.3]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.14, 0.32, 6]} />
      </mesh>
    </>
  );
}

/** Mira: tall, slightly bent star-mage hat with a glowing star on the tip. */
function StarHat({ M }) {
  return (
    <>
      <mesh material={M.hair} position={[0, -0.02, -0.04]} castShadow>
        <sphereGeometry args={[0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.39]} />
      </mesh>
      <mesh material={M.capDark} position={[0, 0.2, 0]} rotation={[-0.08, 0, 0]}>
        <cylinderGeometry args={[0.46, 0.48, 0.05, 20]} />
      </mesh>
      <mesh material={M.cap} position={[0, 0.42, -0.03]} rotation={[-0.15, 0, 0]} castShadow>
        <coneGeometry args={[0.3, 0.46, 12]} />
      </mesh>
      <mesh material={M.cap} position={[0, 0.72, -0.12]} rotation={[-0.55, 0, 0]} castShadow>
        <coneGeometry args={[0.14, 0.3, 10]} />
      </mesh>
      <mesh material={M.plume} position={[0, 0.27, 0.02]} rotation={[-0.1, 0, 0]}>
        <cylinderGeometry args={[0.305, 0.31, 0.06, 16]} />
      </mesh>
      <mesh material={M.star} position={[0, 0.86, -0.26]} rotation={[0.3, 0.4, 0]}>
        <octahedronGeometry args={[0.09, 0]} />
      </mesh>
    </>
  );
}

/** Pip: a round green sprout cap with two leaves and a flower bud on top. */
function SproutHat({ M }) {
  return (
    <>
      <mesh material={M.cap} position={[0, 0.09, -0.01]} castShadow>
        <sphereGeometry args={[0.37, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={M.capDark} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.39, 0.39, 0.04, 18]} />
      </mesh>
      <mesh material={M.cap} position={[0, 0.34, 0]} castShadow>
        <coneGeometry args={[0.16, 0.34, 8]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={M.capDark} position={[side * 0.16, 0.56, 0]} rotation={[0, 0, side * -0.7]} scale={[1, 0.45, 0.6]}>
          <sphereGeometry args={[0.16, 8, 6]} />
        </mesh>
      ))}
      <mesh material={M.star} position={[0, 0.74, 0]}>
        <icosahedronGeometry args={[0.07, 0]} />
      </mesh>
    </>
  );
}

/** Nori: a round glass bubble helmet with a brass neck ring and a brass top valve. */
function DiverHelmet({ M }) {
  return (
    <>
      <mesh material={M.glass} position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.41, 20, 14]} />
      </mesh>
      <mesh material={M.brass} position={[0, -0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.035, 6, 20]} />
      </mesh>
      <mesh material={M.brass} position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.1, 10]} />
      </mesh>
      <mesh material={M.capDark} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
    </>
  );
}

const HATS = { aviator: AviatorHat, fox: FoxHood, star: StarHat, sprout: SproutHat, diver: DiverHelmet };

const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export default function PlayerModel({ mode = 'game', characterId }) {
  const selected = useGame((s) => s.settings.character);
  const character = getCharacter(characterId ?? selected);
  const M = useMemo(() => buildMaterials(character.colors), [character]);
  const Hat = HATS[character.hat] ?? AviatorHat;
  const root = useRef(null);
  const body = useRef(null);
  const torso = useRef(null);
  const head = useRef(null);
  const legL = useRef(null);
  const legR = useRef(null);
  const armL = useRef(null);
  const armR = useRef(null);
  const scarf = useRef(null);
  const eyes = useRef(null);
  const smile = useRef(null);
  const oh = useRef(null);
  const anim = useRef({ t: 0, phase: 0, blink: 2 });

  useFrame((state, delta) => {
    const screen = useGame.getState().screen;
    const a = anim.current;
    const dt = Math.min(delta, 0.05);
    const live = mode === 'menu' || screen === 'playing' || screen === 'victory';
    if (!live || !root.current) return;
    a.t += dt;
    const t = a.t;
    const now = mode === 'menu' ? t : gameClock.time;

    // ---- derive the animation state ----
    let vx = 0, vy = 0, vz = 0, grounded = true, celebrating = false, dead = false;
    if (mode === 'game') {
      ({ x: vx, y: vy, z: vz } = playerState.velocity);
      grounded = playerState.grounded;
      celebrating = playerState.celebrating || screen === 'victory';
      dead = playerState.dead;
      root.current.rotation.y = playerState.facing;
    }
    const speed = Math.hypot(vx, vz);
    let st = 'idle';
    if (mode === 'menu') st = Math.sin(t * 0.6) > 0.55 ? 'wave' : 'idle';
    else if (celebrating) st = 'celebrate';
    else if (dead) st = 'fall';
    else if (!grounded) st = vy > 0 ? 'jump' : 'fall';
    else if (speed > 0.5) st = speed > 8 ? 'run' : 'walk';
    const hurt = mode === 'game' && now - playerState.hurtAt < 0.35;

    // ---- visibility (invulnerability blink, defeated poof) ----
    if (mode === 'game') {
      const blinking = !dead && !celebrating && now < playerState.invulnerableUntil;
      const poofed = dead && playerState.deathReason !== 'fall';
      root.current.visible = !poofed && !(blinking && Math.floor(now * 14) % 2 === 0);
    }

    // ---- limb targets ----
    a.phase += speed * dt * 1.55;
    const amp = Math.min(1, speed / 7) * (st === 'run' ? 1.1 : 0.85);
    const swing = Math.sin(a.phase);
    let lL = 0, lR = 0, aLx = 0, aRx = 0, aLz = 0.12, aRz = -0.12, lean = 0, bob = 0, twist = 0, headTilt = 0;

    switch (st) {
      case 'walk':
      case 'run':
        lL = swing * amp;
        lR = -swing * amp;
        aLx = -swing * amp * 0.9;
        aRx = swing * amp * 0.9;
        aLz = 0.18;
        aRz = -0.18;
        lean = Math.min(0.32, speed * 0.028);
        bob = Math.abs(Math.cos(a.phase)) * 0.07 * amp;
        break;
      case 'jump':
        lL = -0.75;
        lR = 0.35;
        aLx = -2.5;
        aRx = -2.3;
        aLz = 0.35;
        aRz = -0.35;
        lean = 0.12;
        break;
      case 'fall':
        lL = 0.25 + Math.sin(t * 16) * 0.15;
        lR = -0.2 - Math.sin(t * 16) * 0.15;
        aLx = -2.1 + Math.sin(t * 18) * 0.3;
        aRx = -2.1 - Math.sin(t * 18) * 0.3;
        aLz = 0.7;
        aRz = -0.7;
        lean = -0.05;
        break;
      case 'celebrate':
        bob = Math.abs(Math.sin(t * 7)) * 0.38;
        aLx = -2.9;
        aRx = -2.9;
        aLz = 0.45 + Math.sin(t * 14) * 0.35;
        aRz = -0.45 - Math.sin(t * 14) * 0.35;
        lL = -bob * 0.8;
        lR = -bob * 0.8;
        twist = Math.sin(t * 3.5) * 0.45;
        headTilt = Math.sin(t * 7) * 0.15;
        break;
      case 'wave':
        aRx = -2.7;
        aRz = -0.4 - Math.sin(t * 10) * 0.35;
        aLz = 0.15;
        headTilt = Math.sin(t * 2) * 0.1;
        break;
      default: // idle
        aLz = 0.14 + Math.sin(t * 2.1) * 0.04;
        aRz = -0.14 - Math.sin(t * 2.1) * 0.04;
        headTilt = Math.sin(t * 0.9) * 0.06;
        break;
    }
    if (hurt) {
      lean = -0.55;
      aLz = 1.1;
      aRz = -1.1;
      aLx = aRx = -0.6;
    }

    const k = 16;
    legL.current.rotation.x = damp(legL.current.rotation.x, lL, k, dt);
    legR.current.rotation.x = damp(legR.current.rotation.x, lR, k, dt);
    armL.current.rotation.x = damp(armL.current.rotation.x, aLx, k, dt);
    armR.current.rotation.x = damp(armR.current.rotation.x, aRx, k, dt);
    armL.current.rotation.z = damp(armL.current.rotation.z, -aLz, k, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, -aRz, k, dt);
    torso.current.rotation.x = damp(torso.current.rotation.x, lean, 10, dt);
    body.current.rotation.y = damp(body.current.rotation.y, twist, 8, dt);
    head.current.rotation.z = damp(head.current.rotation.z, headTilt, 6, dt);
    head.current.rotation.x = damp(head.current.rotation.x, st === 'fall' ? -0.25 : st === 'jump' ? -0.15 : 0, 8, dt);

    // ---- squash & stretch ----
    let sx = 1, sy = 1;
    if (st === 'idle' || st === 'wave') sy = 1 + Math.sin(t * 2.2) * 0.015;
    if (mode === 'game') {
      const sinceLand = now - playerState.landedAt;
      if (sinceLand < 0.2) {
        const kk = (1 - sinceLand / 0.2) * Math.min(1, playerState.landSpeed / 18);
        sy -= 0.28 * kk;
        sx += 0.2 * kk;
      }
      const sinceJump = now - Math.max(playerState.jumpedAt, playerState.stompAt);
      if (sinceJump < 0.18) {
        const kk = 1 - sinceJump / 0.18;
        sy += 0.14 * kk;
        sx -= 0.08 * kk;
      }
    }
    body.current.scale.set(sx, sy, sx);
    body.current.position.y = damp(body.current.position.y, -0.8 + bob, 20, dt);

    // ---- secondary motion ----
    const flutter = st === 'fall' ? 1.2 : st === 'jump' ? -0.2 : 0.35 + speed * 0.07;
    scarf.current.rotation.x = damp(scarf.current.rotation.x, flutter + Math.sin(t * 9) * 0.12, 8, dt);
    a.blink -= dt;
    if (a.blink < 0) a.blink = 2.5 + Math.random() * 2.5;
    eyes.current.scale.y = a.blink < 0.12 ? 0.15 : 1;

    // ---- expression: smile normally, open "O" mouth when hurt or falling, bigger smile when celebrating ----
    const dazed = hurt || st === 'fall';
    smile.current.visible = !dazed;
    oh.current.visible = dazed;
    smile.current.scale.set(st === 'celebrate' ? 1.35 : 1, st === 'celebrate' ? 1.35 : 1, 1);
  });

  return (
    <group ref={root} scale={0.92}>
      <group ref={body} position={[0, -0.8, 0]}>
        {/* legs (pivot at hip) */}
        <group ref={legL} position={[-0.13, 0.5, 0]}>
          <mesh material={M.pants} position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.2, 4, 8]} />
          </mesh>
          <mesh material={M.boot} position={[0, -0.42, 0.05]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.3]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.13, 0.5, 0]}>
          <mesh material={M.pants} position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.2, 4, 8]} />
          </mesh>
          <mesh material={M.boot} position={[0, -0.42, 0.05]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.3]} />
          </mesh>
        </group>

        <group ref={torso} position={[0, 0.52, 0]}>
          <mesh material={M.tunic} position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.32, 0.52, 12]} />
          </mesh>
          <mesh material={M.tunicDark} position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.33, 0.34, 0.08, 12]} />
          </mesh>
          <mesh material={M.belt} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.3, 0.31, 0.07, 12]} />
          </mesh>
          <mesh material={M.gold} position={[0, 0.1, 0.3]}>
            <boxGeometry args={[0.1, 0.08, 0.03]} />
          </mesh>

          {/* arms (pivot at shoulder) */}
          <group ref={armL} position={[-0.3, 0.44, 0]}>
            <mesh material={M.tunic} position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.18, 4, 8]} />
            </mesh>
            <mesh material={M.skin} position={[0, -0.32, 0]}>
              <sphereGeometry args={[0.085, 10, 8]} />
            </mesh>
          </group>
          <group ref={armR} position={[0.3, 0.44, 0]}>
            <mesh material={M.tunic} position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.18, 4, 8]} />
            </mesh>
            <mesh material={M.skin} position={[0, -0.32, 0]}>
              <sphereGeometry args={[0.085, 10, 8]} />
            </mesh>
          </group>

          {/* backpack + bedroll */}
          <mesh material={M.pack} position={[0, 0.27, -0.29]} castShadow>
            <boxGeometry args={[0.38, 0.4, 0.2]} />
          </mesh>
          <mesh material={M.roll} position={[0, 0.5, -0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.44, 10]} />
          </mesh>

          {/* scarf */}
          <mesh material={M.scarf} position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.07, 8, 14]} />
          </mesh>
          <group ref={scarf} position={[0.08, 0.5, -0.2]}>
            <mesh material={M.scarf} position={[0, -0.16, -0.02]}>
              <boxGeometry args={[0.13, 0.32, 0.04]} />
            </mesh>
          </group>

          {/* head */}
          <group ref={head} position={[0, 0.9, 0]}>
            <mesh material={M.skin} castShadow>
              <sphereGeometry args={[0.34, 18, 14]} />
            </mesh>

            {/* face: big eyes with catch-lights, brows, a smile and an open mouth for hurt/fall */}
            <group ref={eyes} position={[0, -0.05, 0.3]}>
              {[-0.11, 0.11].map((x) => (
                <group key={x} position={[x, 0, 0]}>
                  <mesh material={M.eye} scale={[1, 1.3, 0.5]}>
                    <sphereGeometry args={[0.062, 12, 10]} />
                  </mesh>
                  <mesh material={M.white} position={[x < 0 ? -0.02 : 0.02, 0.03, 0.04]}>
                    <sphereGeometry args={[0.022, 8, 6]} />
                  </mesh>
                  <mesh material={M.white} position={[x < 0 ? 0.02 : -0.02, -0.02, 0.04]} scale={0.5}>
                    <sphereGeometry args={[0.022, 8, 6]} />
                  </mesh>
                  <mesh material={M.brow} position={[0, 0.115, 0.01]} rotation={[0, 0, x < 0 ? 0.2 : -0.2]}>
                    <boxGeometry args={[0.12, 0.03, 0.03]} />
                  </mesh>
                </group>
              ))}
            </group>
            <mesh ref={smile} material={M.eye} position={[0, -0.17, 0.31]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.07, 0.016, 6, 14, Math.PI]} />
            </mesh>
            <mesh ref={oh} material={M.eye} position={[0, -0.18, 0.31]} scale={[1, 1.2, 0.5]} visible={false}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
            <mesh material={M.cheek} position={[-0.19, -0.11, 0.25]}>
              <sphereGeometry args={[0.05, 8, 6]} />
            </mesh>
            <mesh material={M.cheek} position={[0.19, -0.11, 0.25]}>
              <sphereGeometry args={[0.05, 8, 6]} />
            </mesh>
            <Hat M={M} />
          </group>
        </group>
      </group>
    </group>
  );
}
