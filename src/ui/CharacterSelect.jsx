import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import { CHARACTERS } from '../game/characters';
import { audio } from '../audio/AudioManager';
import { Panel, Button } from './common';

/** Flat SVG portrait drawn from the same colour palette as the 3D model. */
function Portrait({ character }) {
  const c = character.colors;
  return (
    <svg viewBox="0 0 120 120" className="portrait" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill={c.tunic} opacity="0.25" />
      <path d="M30 118 Q32 84 60 84 Q88 84 90 118 Z" fill={c.tunic} stroke="#1f1a3a" strokeWidth="3" />
      <path d="M40 88 Q60 98 80 88 L80 94 Q60 104 40 94 Z" fill={c.scarf} stroke="#1f1a3a" strokeWidth="2.5" />
      <circle cx="60" cy="58" r="26" fill={c.skin} stroke="#1f1a3a" strokeWidth="3" />
      <ellipse cx="51" cy="60" rx="3.2" ry="4.6" fill="#1e1b2e" />
      <ellipse cx="69" cy="60" rx="3.2" ry="4.6" fill="#1e1b2e" />
      <circle cx="45" cy="68" r="3.5" fill="#ff9d9d" />
      <circle cx="75" cy="68" r="3.5" fill="#ff9d9d" />
      <path d="M55 70 Q60 74 65 70" stroke="#1e1b2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {character.hat === 'aviator' && (
        <g stroke="#1f1a3a" strokeWidth="3">
          <path d="M33 56 Q34 30 60 30 Q86 30 87 56 Z" fill={c.hat} />
          <rect x="30" y="52" width="8" height="18" rx="3" fill={c.hatDark} />
          <rect x="82" y="52" width="8" height="18" rx="3" fill={c.hatDark} />
          <circle cx="51" cy="42" r="6" fill="#7fe8ff" />
          <circle cx="69" cy="42" r="6" fill="#7fe8ff" />
          <path d="M66 31 Q78 10 86 14 Q78 20 72 33 Z" fill={c.accent} />
        </g>
      )}
      {character.hat === 'fox' && (
        <g stroke="#1f1a3a" strokeWidth="3" strokeLinejoin="round">
          <path d="M34 52 L30 18 L50 32 Z" fill={c.hat} />
          <path d="M86 52 L90 18 L70 32 Z" fill={c.hat} />
          <path d="M32 58 Q32 28 60 28 Q88 28 88 58 Q78 44 60 44 Q42 44 32 58 Z" fill={c.hat} />
          <path d="M42 46 Q60 38 78 46" stroke={c.accent} strokeWidth="5" fill="none" />
        </g>
      )}
      {character.hat === 'star' && (
        <g stroke="#1f1a3a" strokeWidth="3" strokeLinejoin="round">
          <path d="M34 54 Q36 36 60 36 Q84 36 86 54 Q74 46 60 46 Q46 46 34 54 Z" fill={c.hair} />
          <ellipse cx="60" cy="40" rx="34" ry="7" fill={c.hatDark} />
          <path d="M42 39 L58 4 Q66 10 80 20 L78 39 Z" fill={c.hat} />
          <rect x="43" y="32" width="35" height="6" fill={c.accent} />
          <path d="M84 12 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill={c.accent} strokeWidth="2" />
        </g>
      )}
    </svg>
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
      <div className="character-grid" role="radiogroup" aria-label="Character">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={current === c.id}
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
            <span className="cc-title">{c.title}</span>
            <span className="cc-desc">{c.description}</span>
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
