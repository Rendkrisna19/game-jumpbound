import { useEffect, useRef, useState } from 'react';
import { Heart, Gem, Sun, Pause, Target, Flag } from 'lucide-react';
import { useGame, liveScore } from '../game/store';
import { LEVELS } from '../game/levels';
import { GAME } from '../game/constants';
import { gameClock } from '../game/clock';
import { playerState } from '../game/playerState';
import { perf } from '../scene/GameCanvas';
import { audio } from '../audio/AudioManager';
import { formatTime } from './common';

/** Re-mounts its child (restarting the CSS animation) whenever `value` changes. */
function Bump({ value, children }) {
  return (
    <span key={value} className="counter-bump" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  );
}

/** Timer, progress bar and FPS are updated imperatively (no React renders per frame). */
function useTicker(callback, ms = 100) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });
  useEffect(() => {
    const id = window.setInterval(() => cb.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export default function HUD() {
  const levelIndex = useGame((s) => s.levelIndex);
  const health = useGame((s) => s.health);
  const lives = useGame((s) => s.lives);
  const crystals = useGame((s) => s.crystals);
  const sunstones = useGame((s) => s.sunstones);
  const score = useGame(liveScore);
  const screen = useGame((s) => s.screen);
  const pause = useGame((s) => s.pause);
  const showFps = useGame((s) => s.settings.showFps);
  const level = LEVELS[levelIndex];

  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const fpsRef = useRef(null);
  const total = useRef(null);

  useTicker(() => {
    if (timerRef.current) timerRef.current.textContent = formatTime(gameClock.levelTime);
    if (fpsRef.current) fpsRef.current.textContent = `${Math.round(perf.fps)} FPS`;
    if (progressRef.current) {
      const [sx, , sz] = level.spawn;
      const [px, , pz] = level.portal.pos;
      if (total.current === null) total.current = Math.hypot(px - sx, pz - sz) || 1;
      const p = playerState.position;
      const k = 1 - Math.hypot(px - p.x, pz - p.z) / total.current;
      progressRef.current.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
    }
  });

  return (
    <div className="hud" style={{ opacity: screen === 'playing' ? 1 : 0.55 }}>
      <div className="hud-tl">
        <div className="hud-chip">
          <div className="hearts" aria-label={`${health} of ${GAME.maxHealth} health`}>
            {Array.from({ length: GAME.maxHealth }, (_, i) => (
              <Heart key={`${i}-${i < health}`} size={26} strokeWidth={2.5} className={`heart ${i < health ? 'full pop' : 'empty'}`} />
            ))}
          </div>
          <span className="lives-face" aria-hidden="true" />
          <span aria-label={`${lives} lives`}>×{lives}</span>
        </div>
        <div className="hud-chip">
          <Bump value={crystals}>
            <Gem size={22} strokeWidth={2.5} className="gem-icon" />
            {crystals}
            <span className="muted">/{level.crystals.length}</span>
          </Bump>
          <Bump value={`s${sunstones}`}>
            <Sun size={22} strokeWidth={2.5} className="sun-icon" style={{ marginLeft: 8 }} />
            {sunstones}
            <span className="muted">/{level.sunstones.length}</span>
          </Bump>
        </div>
      </div>

      <div className="hud-top">
        <div className="hud-chip level-chip">
          <small>{level.subtitle}</small> {level.name}
        </div>
        <div className="objective">
          <Target size={16} strokeWidth={3} /> {level.objective}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="progress" aria-label="Progress to the portal">
            <div ref={progressRef} className="progress-fill" />
          </div>
          <Flag size={18} strokeWidth={3} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px #000)' }} />
        </div>
      </div>

      <div className="hud-tr">
        <div className="hud-chip stats-chip">
          <span className="score">{score.toLocaleString()}</span>
          <span ref={timerRef} className="muted">0:00.0</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Pause"
          onClick={() => {
            audio.play('menuOpen');
            pause();
          }}
        >
          <Pause size={26} strokeWidth={3} fill="currentColor" />
        </button>
      </div>

      {showFps && <div ref={fpsRef} className="fps" />}
      <Hint />
      <Toast />
      <DamageFlash />
      <LevelBanner />
    </div>
  );
}

function Hint() {
  const hint = useGame((s) => s.hint);
  const screen = useGame((s) => s.screen);
  if (!hint || screen !== 'playing') return null;
  return <div className="hint" key={hint}>{hint}</div>;
}

function Toast() {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    setVisible(toast);
    const id = window.setTimeout(() => setVisible(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);
  if (!visible) return null;
  return (
    <div key={visible.id} className={`toast ${visible.kind}`}>
      {visible.text}
    </div>
  );
}

function DamageFlash() {
  const hurtCount = useGame((s) => s.hurtCount);
  if (!hurtCount) return null;
  return <div key={hurtCount} className="damage-flash" />;
}

function LevelBanner() {
  const runId = useGame((s) => s.runId);
  const levelIndex = useGame((s) => s.levelIndex);
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 3000);
    return () => window.clearTimeout(id);
  }, [runId]);
  if (!show) return null;
  const level = LEVELS[levelIndex];
  return (
    <div className="level-banner" key={runId}>
      <div className="sub">{level.subtitle.toUpperCase()}</div>
      <div className="name">{level.name}</div>
    </div>
  );
}
