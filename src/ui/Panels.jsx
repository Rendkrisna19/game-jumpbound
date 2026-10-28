import { Lock, Clock, Trophy, Gem, Sun } from 'lucide-react';
import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import { audio } from '../audio/AudioManager';
import { Panel, Stars, Button, formatTime } from './common';

// ---------------------------------------------------------------- level select
export function LevelSelect({ onClose }) {
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  return (
    <Panel title="Choose an Island" onClose={onClose}>
      <div className="level-grid">
        {LEVELS.map((level, i) => {
          const locked = i >= progress.unlocked;
          const best = progress.best[level.id];
          return (
            <button
              key={level.id}
              type="button"
              className={`level-card ${level.theme.key}`}
              disabled={locked}
              onMouseEnter={() => !locked && audio.play('hover')}
              onClick={() => {
                audio.unlock();
                audio.play('click');
                startLevel(i);
              }}
            >
              <span className="lc-sub">{level.subtitle}</span>
              <span className="lc-name">{level.name}</span>
              {locked ? (
                <span className="lc-best" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={16} strokeWidth={3} /> Finish the previous island
                </span>
              ) : best ? (
                <span className="lc-best">
                  <Stars count={best.stars} />
                  <span style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span><Trophy size={13} /> {best.score}</span>
                    <span><Clock size={13} /> {formatTime(best.time)}</span>
                  </span>
                </span>
              ) : (
                <span className="lc-best">Not completed yet</span>
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- how to play
export const CONTROLS = [
  [['W', 'A', 'S', 'D'], 'Move (arrow keys also work)'],
  [['Space'], 'Jump — hold for a higher jump'],
  [['Shift'], 'Sprint (hold while moving)'],
  [['Mouse drag'], 'Orbit the camera · wheel to zoom'],
  [['Q', 'E'], 'Rotate the camera'],
  [['Esc', 'P'], 'Pause / resume'],
  [['R'], 'Return to the last checkpoint'],
];

export function ControlsTable() {
  return (
    <div className="controls">
      {CONTROLS.map(([keys, label]) => (
        <div key={label} style={{ display: 'contents' }}>
          <span className="keys">
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function HowToPlay({ onClose }) {
  return (
    <Panel title="How to Play" onClose={onClose}>
      <p>
        Guide <b>Wren</b> across the floating islands, gather <b>crystals</b> and reach the glowing <b>portal</b> at
        the end of each island.
      </p>
      <h3>Controls</h3>
      <ControlsTable />
      <h3>Tips</h3>
      <ul className="tips">
        <li>
          <Gem size={15} className="gem-icon" /> Crystals stay collected even if you lose a life. Find the rare{' '}
          <Sun size={15} className="sun-icon" /> <b>Sunstones</b> hidden on side paths.
        </li>
        <li>Jump on <b>Forest Wanderers</b> to defeat them. Touching them from the side hurts!</li>
        <li><b>Crystal Guardians</b> flash red before they charge. Dodge, then stomp them while they rest.</li>
        <li>Touch a <b>Wayshrine</b> to set your checkpoint. You respawn there after losing a life.</li>
        <li>Teal <b>Glowcaps</b> bounce you high; glowing tiles fade away — keep moving.</li>
        <li>Press Jump slightly early or just after running off a ledge — the game forgives you.</li>
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- settings
function Slider({ label, value, onChange }) {
  return (
    <div className="setting">
      <label>
        {label}
        <span className="value">{Math.round(value * 100)}%</span>
      </label>
      <input className="slider" type="range" min="0" max="1" step="0.05" value={value} aria-label={label} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="setting">
      <label>{label}</label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`toggle ${value ? 'on' : ''}`}
        onClick={() => {
          audio.play('click');
          onChange(!value);
        }}
      />
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="setting">
      <label>{label}</label>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? 'active' : ''}
            onClick={() => {
              audio.play('click');
              onChange(v);
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose }) {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const resetProgress = useGame((s) => s.resetProgress);
  const screen = useGame((s) => s.screen);
  return (
    <Panel title="Settings" onClose={onClose}>
      <h3>Audio</h3>
      <Slider label="Master volume" value={settings.masterVolume} onChange={(v) => update({ masterVolume: v })} />
      <Slider label="Music" value={settings.musicVolume} onChange={(v) => update({ musicVolume: v })} />
      <Slider label="Sound effects" value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
      <h3>Graphics</h3>
      <Segmented
        label="Quality"
        value={settings.quality}
        options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]}
        onChange={(v) => update({ quality: v })}
      />
      <p className="muted">Low disables shadows and thins out decorations. Anti-aliasing changes apply after a page reload.</p>
      <Toggle label="Show FPS" value={settings.showFps} onChange={(v) => update({ showFps: v })} />
      <h3>Camera &amp; controls</h3>
      <div className="setting">
        <label>
          Mouse sensitivity<span className="value">{settings.mouseSensitivity.toFixed(1)}×</span>
        </label>
        <input
          className="slider"
          type="range"
          min="0.2"
          max="2.5"
          step="0.1"
          aria-label="Mouse sensitivity"
          value={settings.mouseSensitivity}
          onChange={(e) => update({ mouseSensitivity: parseFloat(e.target.value) })}
        />
      </div>
      <Toggle label="Invert vertical look" value={settings.invertY} onChange={(v) => update({ invertY: v })} />
      <Toggle label="Camera shake" value={settings.cameraShake} onChange={(v) => update({ cameraShake: v })} />
      <Segmented
        label="Touch controls"
        value={settings.touchControls}
        options={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]}
        onChange={(v) => update({ touchControls: v })}
      />
      <h3>Controls</h3>
      <ControlsTable />
      {screen === 'menu' && (
        <div className="panel-actions">
          <Button
            variant="light small"
            onClick={() => {
              if (window.confirm('Reset all island progress and best scores?')) resetProgress();
            }}
          >
            Reset progress
          </Button>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- credits
export function Credits({ onClose }) {
  return (
    <Panel title="Credits" onClose={onClose}>
      <p style={{ textAlign: 'center' }}>
        <b>JUMPBOUND: The Lost Island</b>
        <br />
        An original 3D platformer adventure.
      </p>
      <h3>Made with</h3>
      <ul className="credits-list">
        <li>React, Vite, Three.js, React Three Fiber, drei</li>
        <li>Rapier physics via @react-three/rapier</li>
        <li>Zustand state, Lucide icons</li>
      </ul>
      <h3>Art &amp; audio</h3>
      <ul className="credits-list">
        <li>All 3D models, the hero Wren, enemies and worlds are procedurally built from primitives in code.</li>
        <li>All sound effects and music are synthesised live with the Web Audio API.</li>
        <li>Font: Fredoka © The Fredoka Project Authors — SIL Open Font License 1.1 (via @fontsource).</li>
      </ul>
      <p className="muted">Full licence details are listed in ASSET_CREDITS.md.</p>
    </Panel>
  );
}
