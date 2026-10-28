import { Play, RotateCcw, Settings, House, ChevronRight, Gem, Sun, Clock, Swords, Award } from 'lucide-react';
import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import { Panel, Button, Stars, formatTime } from './common';

export function PauseMenu() {
  const resume = useGame((s) => s.resume);
  const restartLevel = useGame((s) => s.restartLevel);
  const goToMenu = useGame((s) => s.goToMenu);
  const openPanel = useGame((s) => s.openPanel);
  const levelIndex = useGame((s) => s.levelIndex);
  return (
    <Panel title="Paused" narrow>
      <p className="result-sub">{LEVELS[levelIndex].name}</p>
      <div className="panel-actions">
        <Button onClick={resume} sound="menuClose" autoFocus>
          <Play size={22} strokeWidth={3} fill="#fff" /> Resume
        </Button>
        <Button variant="orange" onClick={restartLevel}>
          <RotateCcw size={22} strokeWidth={3} /> Restart Level
        </Button>
        <Button variant="violet" onClick={() => openPanel('settings')} sound="menuOpen">
          <Settings size={22} strokeWidth={3} /> Settings
        </Button>
        <Button variant="light" onClick={goToMenu}>
          <House size={22} strokeWidth={3} /> Main Menu
        </Button>
      </div>
    </Panel>
  );
}

export function VictoryScreen() {
  const result = useGame((s) => s.result);
  const nextLevel = useGame((s) => s.nextLevel);
  const restartLevel = useGame((s) => s.restartLevel);
  const goToMenu = useGame((s) => s.goToMenu);
  const openPanel = useGame((s) => s.openPanel);
  if (!result) return null;
  const level = LEVELS[result.levelIndex];
  const b = result.breakdown;
  const rows = [
    ['Crystals', b.crystals],
    ['Sunstones', b.sunstones],
    ['Enemies', b.enemies],
    ['Island cleared', b.completion],
    ['Time bonus', b.time],
    ['Lives left', b.lives],
    ['All crystals', b.perfect],
  ].filter(([, v]) => v > 0);

  return (
    <Panel>
      <h1 className="result-title">{result.final ? 'Island Restored!' : 'Level Complete!'}</h1>
      <p className="result-sub">
        {result.final ? 'The Sun Gate shines again over the Lost Island.' : `${level.name} cleared`}
      </p>
      <div className="result-stars">
        <Stars count={result.stars} size={52} />
      </div>
      <div className="result-grid">
        <div className="result-stat">
          <div className="label">Crystals</div>
          <div className="val"><Gem size={20} className="gem-icon" />{result.crystals}/{result.totalCrystals}</div>
        </div>
        <div className="result-stat">
          <div className="label">Sunstones</div>
          <div className="val"><Sun size={20} className="sun-icon" />{result.sunstones}/{result.totalSunstones}</div>
        </div>
        <div className="result-stat">
          <div className="label">Time</div>
          <div className="val"><Clock size={20} />{formatTime(result.time)}</div>
        </div>
      </div>
      <table className="breakdown">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>+{v.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="total">
            <td>
              Final score {result.newBest && <span className="new-best">New best!</span>}
            </td>
            <td>{result.score.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ textAlign: 'center' }}>
        <Swords size={14} /> Enemies defeated: {result.enemiesDefeated}
      </p>
      <div className="panel-actions row">
        {result.final ? (
          <Button onClick={() => openPanel('credits')} sound="menuOpen">
            <Award size={22} strokeWidth={3} /> Credits
          </Button>
        ) : (
          <Button onClick={nextLevel} sound="menuOpen" autoFocus>
            Next Level <ChevronRight size={24} strokeWidth={3} />
          </Button>
        )}
        <Button variant="orange" onClick={restartLevel}>
          <RotateCcw size={22} strokeWidth={3} /> Replay
        </Button>
        <Button variant="light" onClick={goToMenu}>
          <House size={22} strokeWidth={3} /> Main Menu
        </Button>
      </div>
    </Panel>
  );
}

export function GameOverScreen() {
  const restartLevel = useGame((s) => s.restartLevel);
  const goToMenu = useGame((s) => s.goToMenu);
  const crystals = useGame((s) => s.crystals);
  const levelIndex = useGame((s) => s.levelIndex);
  return (
    <Panel narrow>
      <h1 className="result-title" style={{ color: '#ff8a9a' }}>Out of Lives</h1>
      <p className="result-sub">
        {LEVELS[levelIndex].name} · {crystals} crystals gathered
      </p>
      <p style={{ textAlign: 'center' }}>Wren dusts off their cap. Ready to try again?</p>
      <div className="panel-actions">
        <Button onClick={restartLevel} autoFocus>
          <RotateCcw size={22} strokeWidth={3} /> Retry Level
        </Button>
        <Button variant="light" onClick={goToMenu}>
          <House size={22} strokeWidth={3} /> Main Menu
        </Button>
      </div>
    </Panel>
  );
}
