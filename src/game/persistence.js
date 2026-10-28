// localStorage-backed settings and progression. All access is guarded so private
// browsing modes or disabled storage never crash the game.

const SETTINGS_KEY = 'jumpbound.settings.v1';
const PROGRESS_KEY = 'jumpbound.progress.v1';

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  quality: 'medium', // 'low' | 'medium' | 'high'
  mouseSensitivity: 1,
  invertY: false,
  cameraShake: true,
  touchControls: 'auto', // 'auto' | 'on' | 'off'
  showFps: false,
  character: 'wren', // 'wren' | 'kiko' | 'mira'
};

export const DEFAULT_PROGRESS = {
  unlocked: 1, // number of unlocked levels
  best: {}, // levelId -> { score, time, crystals, sunstones, stars }
  completedGame: false,
};

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — progress simply won't persist
  }
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY);
  const merged = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  if (!['low', 'medium', 'high'].includes(merged.quality)) merged.quality = DEFAULT_SETTINGS.quality;
  if (!['wren', 'kiko', 'mira'].includes(merged.character)) merged.character = DEFAULT_SETTINGS.character;
  return merged;
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function loadProgress() {
  const saved = read(PROGRESS_KEY);
  return { ...DEFAULT_PROGRESS, ...(saved || {}), best: { ...(saved?.best || {}) } };
}

export function saveProgress(progress) {
  write(PROGRESS_KEY, progress);
}
