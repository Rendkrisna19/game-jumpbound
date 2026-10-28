import { Play, Map, CircleHelp, Settings, Award, UserRound } from 'lucide-react';
import { useGame } from '../game/store';
import { LEVELS } from '../game/levels';
import { getCharacter } from '../game/characters';
import { Button } from './common';

const TITLE = 'JUMPBOUND';

export default function MainMenu() {
  const progress = useGame((s) => s.progress);
  const startLevel = useGame((s) => s.startLevel);
  const openPanel = useGame((s) => s.openPanel);
  const next = Math.min(progress.unlocked - 1, LEVELS.length - 1);
  const fresh = progress.unlocked <= 1 && !progress.best[LEVELS[0].id];
  const hero = getCharacter(useGame((s) => s.settings.character));

  return (
    <div className="menu-screen">
      <div className="logo">
        <div className="logo-title" aria-label={TITLE}>
          {TITLE.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="logo-ribbon">THE LOST ISLAND</div>
      </div>

      <div className="menu-buttons">
        {/* A brand-new player picks a hero first; returning players jump straight in. */}
        <Button onClick={() => (fresh ? openPanel('characters') : startLevel(next))} sound="menuOpen" autoFocus>
          <Play size={24} strokeWidth={3} fill="#fff" />
          {fresh ? 'Play' : `Continue · ${LEVELS[next].name}`}
        </Button>
        <div className="menu-row">
          <Button variant="orange" onClick={() => openPanel('characters')} sound="menuOpen">
            <UserRound size={22} strokeWidth={3} /> Hero: {hero.name}
          </Button>
        </div>
        <div className="menu-row">
          <Button variant="sky" onClick={() => openPanel('levels')} sound="menuOpen">
            <Map size={22} strokeWidth={3} /> Levels
          </Button>
          <Button variant="light" onClick={() => openPanel('howto')} sound="menuOpen">
            <CircleHelp size={22} strokeWidth={3} /> How to Play
          </Button>
        </div>
        <div className="menu-row">
          <Button variant="violet" onClick={() => openPanel('settings')} sound="menuOpen">
            <Settings size={22} strokeWidth={3} /> Settings
          </Button>
          <Button variant="light" onClick={() => openPanel('credits')} sound="menuOpen">
            <Award size={22} strokeWidth={3} /> Credits
          </Button>
        </div>
      </div>

      <div className="menu-footer">
        {progress.completedGame ? 'The Lost Island has been restored — thank you for playing!' : 'WASD to move · Space to jump · Shift to sprint · Esc to pause'}
      </div>
    </div>
  );
}
