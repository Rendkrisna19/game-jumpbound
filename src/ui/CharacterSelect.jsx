import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import { CHARACTERS } from '../game/characters';
import PlayerModel from '../scene/player/PlayerModel';
import { audio } from '../audio/AudioManager';
import { Panel, Button } from './common';

const INK = '#1f1a3a';

/** Flat SVG portrait drawn from the same palette and face layout as the 3D model. */
function Portrait({ character }) {
  const c = character.colors;
  return (
    <svg viewBox="0 0 120 120" className="portrait" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill={c.tunic} opacity="0.25" />
      <path d="M30 118 Q32 84 60 84 Q88 84 90 118 Z" fill={c.tunic} stroke={INK} strokeWidth="3" />
      <path d="M40 88 Q60 98 80 88 L80 94 Q60 104 40 94 Z" fill={c.scarf} stroke={INK} strokeWidth="2.5" />
      <circle cx="60" cy="58" r="26" fill={c.skin} stroke={INK} strokeWidth="3" />
      {/* face: big eyes with catch-lights, brows, cheeks and a smile */}
      <ellipse cx="51" cy="62" rx="4.4" ry="6" fill="#1e1b2e" />
      <ellipse cx="69" cy="62" rx="4.4" ry="6" fill="#1e1b2e" />
      <circle cx="52.6" cy="59" r="1.8" fill="#ffffff" />
      <circle cx="70.6" cy="59" r="1.8" fill="#ffffff" />
      <path d="M44 52 Q51 48 56 51" stroke={c.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M64 51 Q69 48 76 52" stroke={c.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="45" cy="68" r="3.5" fill="#ff9d9d" />
      <circle cx="75" cy="68" r="3.5" fill="#ff9d9d" />
      <path d="M53 72 Q60 79 67 72" stroke="#1e1b2e" strokeWidth="2.6" fill="none" strokeLinecap="round" />

      {character.hat === 'aviator' && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M33 50 Q34 26 60 26 Q86 26 87 50 Z" fill={c.hat} />
          <rect x="30" y="46" width="8" height="18" rx="3" fill={c.hatDark} />
          <rect x="82" y="46" width="8" height="18" rx="3" fill={c.hatDark} />
          <circle cx="51" cy="34" r="5.5" fill="#7fe8ff" />
          <circle cx="69" cy="34" r="5.5" fill="#7fe8ff" />
          <path d="M66 27 Q78 6 86 10 Q78 16 72 29 Z" fill={c.accent} />
        </g>
      )}
      {character.hat === 'fox' && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M34 44 L30 14 L50 28 Z" fill={c.hat} />
          <path d="M86 44 L90 14 L70 28 Z" fill={c.hat} />
          <path d="M31 50 Q30 24 60 24 Q90 24 89 50 Q80 40 60 40 Q40 40 31 50 Z" fill={c.hat} />
        </g>
      )}
      {character.hat === 'star' && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M34 48 Q36 30 60 30 Q84 30 86 48 Q74 40 60 40 Q46 40 34 48 Z" fill={c.hair} />
          <ellipse cx="60" cy="38" rx="34" ry="6" fill={c.hatDark} />
          <path d="M42 36 L58 4 Q66 10 80 20 L78 36 Z" fill={c.hat} />
          <rect x="43" y="30" width="35" height="6" fill={c.accent} />
          <path d="M84 12 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill={c.accent} strokeWidth="2" />
        </g>
      )}
      {character.hat === 'sprout' && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M34 50 Q34 28 60 28 Q86 28 86 50 Z" fill={c.hat} />
          <path d="M48 32 L60 8 L72 32 Z" fill={c.hat} />
          <ellipse cx="49" cy="22" rx="7" ry="3.5" transform="rotate(-30 49 22)" fill={c.hatDark} />
          <ellipse cx="71" cy="22" rx="7" ry="3.5" transform="rotate(30 71 22)" fill={c.hatDark} />
          <circle cx="60" cy="7" r="3.5" fill={c.accent} />
        </g>
      )}
      {character.hat === 'diver' && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <circle cx="60" cy="58" r="34" fill={c.hat} opacity="0.35" />
          <ellipse cx="60" cy="84" rx="30" ry="6" fill="none" stroke={c.accent} strokeWidth="4" />
          <rect x="55" y="19" width="10" height="9" rx="2" fill={c.accent} />
        </g>
      )}
    </svg>
  );
}

/** Slowly turning 3D preview of the chosen hero, using the same model as the game. */
function Turntable({ characterId }) {
  const spin = useRef(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.5;
  });
  return (
    <group ref={spin}>
      <PlayerModel mode="menu" characterId={characterId} />
    </group>
  );
}

function HeroPreview({ characterId }) {
  return (
    <div className="hero-preview">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0.6, 3.6], fov: 32 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 3]} intensity={1.6} />
        <hemisphereLight args={['#ffffff', '#7ab648', 0.6]} />
        <Turntable characterId={characterId} />
      </Canvas>
    </div>
  );
}

export default function CharacterSelect({ onClose }) {
  const current = useGame((s) => s.settings.character);
  const update = useGame((s) => s.updateSettings);
  const screen = useGame((s) => s.screen);
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  const chosen = CHARACTERS.find((c) => c.id === current) ?? CHARACTERS[0];
  const next = Math.min(progress.unlocked - 1, LEVELS.length - 1);

  return (
    <Panel title="Choose Your Hero" onClose={onClose}>
      <HeroPreview characterId={chosen.id} />
      <div className="hero-info">
        <b>{chosen.name}</b> · <span className="cc-title">{chosen.title}</span>
        <p>{chosen.description}</p>
      </div>
      <div className="character-grid" role="radiogroup" aria-label="Character">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={current === c.id}
            aria-label={`${c.name}, ${c.title}`}
            className={`character-card ${current === c.id ? 'selected' : ''}`}
            style={{ '--card': c.colors.tunic }}
            onMouseEnter={() => audio.play('hover')}
            onClick={() => {
              audio.unlock();
              audio.play('click');
              update({ character: c.id });
            }}
          >
            <Portrait character={c} />
            <span className="cc-name">{c.name}</span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        All heroes move and jump the same way. Your choice is saved and shown in the island preview.
      </p>
      {screen === 'menu' && (
        <div className="panel-actions">
          <Button onClick={() => startLevel(next)} sound="menuOpen">
            Start Adventure as {chosen.name}
          </Button>
        </div>
      )}
    </Panel>
  );
}
