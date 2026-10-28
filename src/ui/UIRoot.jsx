import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import MainMenu from './MainMenu';
import HUD from './HUD';
import { PauseMenu, VictoryScreen, GameOverScreen } from './Screens';
import { LevelSelect, HowToPlay, SettingsPanel, Credits } from './Panels';
import TouchControls from './TouchControls';
import CharacterSelect from './CharacterSelect';

const PANELS = { characters: CharacterSelect, levels: LevelSelect, howto: HowToPlay, settings: SettingsPanel, credits: Credits };

function useIsTouchDevice() {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  useEffect(() => {
    const onTouch = () => setTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);
  return touch;
}

export default function UIRoot() {
  const screen = useGame((s) => s.screen);
  const panel = useGame((s) => s.panel);
  const closePanel = useGame((s) => s.closePanel);
  const touchSetting = useGame((s) => s.settings.touchControls);
  const isTouch = useIsTouchDevice();
  const showTouch = screen === 'playing' && (touchSetting === 'on' || (touchSetting === 'auto' && isTouch));
  const PanelComponent = panel ? PANELS[panel] : null;
  const inGame = screen !== 'menu';

  return (
    <div className="ui-root">
      {screen === 'menu' && !panel && <MainMenu />}
      {inGame && <HUD />}
      {showTouch && <TouchControls />}
      {screen === 'paused' && !panel && <PauseMenu />}
      {screen === 'victory' && !panel && <VictoryScreen />}
      {screen === 'gameover' && !panel && <GameOverScreen />}
      {PanelComponent && <PanelComponent onClose={closePanel} />}
    </div>
  );
}
