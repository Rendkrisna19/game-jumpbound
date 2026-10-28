import { useEffect, useState } from 'react';
import GameCanvas from './scene/GameCanvas';
import UIRoot from './ui/UIRoot';
import { Panel } from './ui/common';
import { useGame, getGame } from './game/store';
import { LEVELS } from './game/levels';
import { attachKeyboard, resetInput } from './game/input';
import { playerApi, playerState } from './game/playerState';
import { gameClock } from './game/clock';
import { audio } from './audio/AudioManager';
import { enemyDebug } from './scene/entities/Enemies';

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function WebGLFallback() {
  return (
    <div className="fallback">
      <Panel title="WebGL is unavailable">
        <p>
          JUMPBOUND needs WebGL to draw its 3D world, but your browser or graphics driver didn&apos;t provide it.
        </p>
        <ul className="tips">
          <li>Enable hardware acceleration in your browser settings and restart the browser.</li>
          <li>Update your graphics drivers, or try a recent Chrome, Edge, Firefox or Safari.</li>
          <li>Check that WebGL isn&apos;t blocked by an extension or a corporate policy.</li>
        </ul>
      </Panel>
    </div>
  );
}

/** Keeps the audio engine in sync with settings and game state. */
function useAudioDirector() {
  useEffect(() => {
    const apply = (s) => audio.setVolumes(s.settings);
    apply(getGame());

    const syncMusic = (s, prev) => {
      if (s.screen === 'menu') audio.playMusic('menu');
      else if (s.screen === 'playing' || s.screen === 'paused') audio.playMusic(LEVELS[s.levelIndex].theme.music);
      else if (s.screen === 'gameover' && prev?.screen !== 'gameover') {
        audio.stopMusic();
        audio.play('gameover');
      } else if (s.screen === 'victory') audio.stopMusic();
      audio.duck(s.screen === 'paused' || !!s.panel);
    };
    syncMusic(getGame());

    const unsub = useGame.subscribe((s, prev) => {
      if (s.settings !== prev.settings) apply(s);
      if (s.screen !== prev.screen || s.levelIndex !== prev.levelIndex || s.panel !== prev.panel || s.runId !== prev.runId) {
        syncMusic(s, prev);
      }
    });

    // Browsers only allow audio after a user gesture.
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.stopMusic();
    };
  }, []);
}

function useKeyboard() {
  useEffect(() => {
    const isActive = () => getGame().screen === 'playing';
    const detach = attachKeyboard(
      (action) => {
        const g = getGame();
        if (action === 'pause') {
          const wasPlaying = g.screen === 'playing';
          if (g.screen === 'playing' || g.screen === 'paused' || g.panel) {
            audio.play(wasPlaying ? 'menuOpen' : 'menuClose');
            g.handleEscape();
          }
        } else if (action === 'restartCheckpoint') {
          if (g.screen === 'playing') playerApi.respawnAtCheckpoint();
        } else if (action === 'blur') {
          g.pause();
        }
      },
      isActive,
    );
    const onVisibility = () => {
      if (document.hidden) {
        resetInput();
        getGame().pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      detach();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

/** Debug/test hook: exposes state for automated smoke tests (?debug or dev builds). */
function useDebugHook() {
  useEffect(() => {
    if (!import.meta.env.DEV && !window.location.search.includes('debug')) return undefined;
    window.__jumpbound = { getGame, playerState, playerApi, gameClock, LEVELS, enemies: () => Object.fromEntries(enemyDebug) };
    return () => {
      delete window.__jumpbound;
    };
  }, []);
}

export default function App() {
  const [webgl] = useState(detectWebGL);
  useAudioDirector();
  useKeyboard();
  useDebugHook();
  return (
    <div className="app">
      {webgl ? <GameCanvas /> : <WebGLFallback />}
      {webgl && <UIRoot />}
    </div>
  );
}
