import { create } from 'zustand';
import { LEVELS } from './levels/index.js';
import { GAME, SCORE } from './constants.js';
import {
  loadSettings,
  saveSettings,
  loadProgress,
  saveProgress,
  DEFAULT_PROGRESS,
} from './persistence.js';
import { resetClock, gameClock } from './clock.js';

/**
 * Per-attempt bookkeeping that must never double count. Lives outside React state
 * because it is checked from the render loop.
 *
 * Collectible rule (consistent across the game): crystals, sunstones and defeated
 * enemies STAY collected/defeated when you lose a life and respawn at a checkpoint.
 * Everything resets when the level is restarted or after a game over.
 */
export const session = {
  collected: new Set(),
  sunstones: new Set(),
  defeated: new Set(),
  checkpoint: null, // { index, pos: [x, y, z] }
  hintsShown: new Set(),
};

function resetSession() {
  session.collected.clear();
  session.sunstones.clear();
  session.defeated.clear();
  session.checkpoint = null;
  session.hintsShown.clear();
}

const freshRunState = () => ({
  health: GAME.maxHealth,
  lives: GAME.startLives,
  crystals: 0,
  sunstones: 0,
  enemyScore: 0,
  enemiesDefeated: 0,
  checkpointIndex: -1,
  hurtCount: 0,
  toast: null,
  hint: null,
  result: null,
});

let toastId = 0;

export const useGame = create((set, get) => ({
  screen: 'menu', // 'menu' | 'playing' | 'paused' | 'victory' | 'gameover'
  panel: null, // overlay panel: 'levels' | 'howto' | 'settings' | 'credits'
  levelIndex: 0,
  runId: 0,
  ...freshRunState(),
  settings: loadSettings(),
  progress: loadProgress(),

  // ---------- flow ----------
  startLevel(index) {
    const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    resetSession();
    resetClock();
    set((s) => ({
      ...freshRunState(),
      screen: 'playing',
      panel: null,
      levelIndex,
      runId: s.runId + 1,
    }));
  },
  restartLevel() {
    get().startLevel(get().levelIndex);
  },
  nextLevel() {
    const { levelIndex } = get();
    if (levelIndex < LEVELS.length - 1) get().startLevel(levelIndex + 1);
    else get().goToMenu();
  },
  pause() {
    if (get().screen === 'playing') set({ screen: 'paused', panel: null });
  },
  resume() {
    if (get().screen === 'paused') set({ screen: 'playing', panel: null });
  },
  /** Escape key behaviour: close an open panel first, otherwise toggle pause. */
  handleEscape() {
    const { screen, panel } = get();
    if (panel) set({ panel: null });
    else if (screen === 'playing') get().pause();
    else if (screen === 'paused') get().resume();
  },
  goToMenu() {
    resetSession();
    set({ ...freshRunState(), screen: 'menu', panel: null });
  },
  openPanel(panel) {
    set({ panel });
  },
  closePanel() {
    set({ panel: null });
  },

  // ---------- gameplay events ----------
  collectCrystal(id) {
    if (session.collected.has(id)) return false;
    session.collected.add(id);
    set((s) => ({ crystals: s.crystals + 1 }));
    return true;
  },
  collectSunstone(id) {
    if (session.sunstones.has(id)) return false;
    session.sunstones.add(id);
    set((s) => ({ sunstones: s.sunstones + 1 }));
    get().showToast('Sunstone found!', 'gold');
    return true;
  },
  defeatEnemy(id, kind) {
    if (session.defeated.has(id)) return false;
    session.defeated.add(id);
    const points = kind === 'guardian' ? SCORE.guardian : SCORE.wanderer;
    set((s) => ({ enemyScore: s.enemyScore + points, enemiesDefeated: s.enemiesDefeated + 1 }));
    return true;
  },
  activateCheckpoint(index, pos) {
    if (index <= get().checkpointIndex) return false;
    session.checkpoint = { index, pos };
    set({ checkpointIndex: index });
    get().showToast('Checkpoint reached!', 'green');
    return true;
  },
  /** Returns remaining health. */
  damage() {
    const health = Math.max(0, get().health - 1);
    set((s) => ({ health, hurtCount: s.hurtCount + 1 }));
    return health;
  },
  /** Returns true if the player may respawn, false on game over. */
  loseLife() {
    const lives = get().lives - 1;
    if (lives <= 0) {
      set({ lives: 0, health: 0, screen: 'gameover', panel: null });
      return false;
    }
    set({ lives, health: GAME.maxHealth });
    return true;
  },
  showToast(text, kind = 'info') {
    toastId += 1;
    set({ toast: { id: toastId, text, kind } });
  },
  setHint(hint) {
    if (get().hint !== hint) set({ hint });
  },

  completeLevel() {
    const { levelIndex, crystals, sunstones, enemyScore, enemiesDefeated, lives, progress } = get();
    const level = LEVELS[levelIndex];
    const time = gameClock.levelTime;
    const totalCrystals = level.crystals.length;
    const totalSunstones = level.sunstones.length;

    const breakdown = {
      crystals: crystals * SCORE.crystal,
      sunstones: sunstones * SCORE.sunstone,
      enemies: enemyScore,
      completion: SCORE.completion,
      time: Math.max(0, Math.round((level.parTime - time) * SCORE.timeBonusPerSecond)),
      lives: lives * 100,
      perfect: crystals >= totalCrystals ? SCORE.perfectBonus : 0,
    };
    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const stars = 1 + (crystals / totalCrystals >= 0.75 ? 1 : 0) + (sunstones >= totalSunstones ? 1 : 0);

    const prev = progress.best[level.id];
    const best = {
      score: Math.max(prev?.score ?? 0, score),
      time: Math.min(prev?.time ?? Infinity, time),
      crystals: Math.max(prev?.crystals ?? 0, crystals),
      sunstones: Math.max(prev?.sunstones ?? 0, sunstones),
      stars: Math.max(prev?.stars ?? 0, stars),
    };
    const nextProgress = {
      ...progress,
      unlocked: Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2)),
      best: { ...progress.best, [level.id]: best },
      completedGame: progress.completedGame || !!level.final,
    };
    saveProgress(nextProgress);

    set({
      screen: 'victory',
      panel: null,
      progress: nextProgress,
      result: {
        levelIndex,
        score,
        breakdown,
        stars,
        time,
        crystals,
        totalCrystals,
        sunstones,
        totalSunstones,
        enemiesDefeated,
        newBest: !prev || score > prev.score,
        final: !!level.final,
      },
    });
  },

  // ---------- settings & progress ----------
  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    set({ settings });
  },
  resetProgress() {
    const progress = { ...DEFAULT_PROGRESS, best: {} };
    saveProgress(progress);
    set({ progress });
  },
}));

export const getGame = useGame.getState;

/** Gameplay simulation runs only in this state. */
export const isPlaying = () => useGame.getState().screen === 'playing';

/** Live score shown on the HUD. */
export function liveScore(s) {
  return s.crystals * SCORE.crystal + s.sunstones * SCORE.sunstone + s.enemyScore;
}
