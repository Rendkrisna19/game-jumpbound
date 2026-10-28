// Game clock that only advances while gameplay is running (so pausing freezes every timer).
export const gameClock = {
  time: 0, // total gameplay seconds since the level was (re)started
  delta: 0, // last gameplay delta (0 while paused)
  levelTime: 0, // timer shown on the HUD
};

export function resetClock() {
  gameClock.time = 0;
  gameClock.delta = 0;
  gameClock.levelTime = 0;
}

export const MAX_DT = 1 / 20;
