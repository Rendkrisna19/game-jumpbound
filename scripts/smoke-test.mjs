// End-to-end smoke test: builds nothing, serves dist/ with `vite preview`, drives the real game
// in headless Chrome/Edge (WebGL via SwiftShader) and asserts the core gameplay loop works.
//   npm run build && npm run smoke
// Set BROWSER=/path/to/chrome to choose a browser executable.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const PORT = 4179;
const PAGE_URL = `http://localhost:${PORT}/?debug`;
const SHOTS = fileURLToPath(new URL('./.shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

const candidates = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge executable found. Set BROWSER=...');
  process.exit(1);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' });
let serverOut = '';
server.stdout.on('data', (d) => (serverOut += d));
server.stderr.on('data', (d) => (serverOut += d));

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function waitFor(fn, timeout = 15000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch {
      // keep polling
    }
    await sleep(interval);
  }
  return false;
}

let browser;
try {
  const up = await waitFor(async () => (await fetch(`http://localhost:${PORT}/`)).ok, 30000, 300);
  if (!up) throw new Error(`preview server did not start:\n${serverOut}`);

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`);
  });

  const game = (expr) => page.evaluate(`(() => { const j = window.__jumpbound; return ${expr}; })()`);
  const state = () => game('({ screen: j.getGame().screen, lives: j.getGame().lives, health: j.getGame().health, crystals: j.getGame().crystals, cp: j.getGame().checkpointIndex, level: j.getGame().levelIndex, t: j.gameClock.time, p: j.playerState.position.toArray(), grounded: j.playerState.grounded, dead: j.playerState.dead })');
  const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  check('debug hook available', await waitFor(() => game('!!j')));
  await sleep(4000);
  await shot('01-menu');
  check('menu renders a WebGL canvas', await game('!!document.querySelector("canvas")'));

  // ---- start level 1 via the Play button ----
  const [playBtn] = await page.$$('xpath/.//button[contains(., "Play") or contains(., "Continue")]');
  await playBtn.click();
  // A fresh save opens the hero picker first.
  if (await waitFor(() => game('j.getGame().panel === "characters"'), 3000)) {
    const [startBtn] = await page.$$('xpath/.//button[contains(., "Start Adventure")]');
    await startBtn.click();
  }
  check('Play button starts level 1', await waitFor(async () => (await state()).screen === 'playing'));
  check('player lands on the start island', await waitFor(async () => (await state()).grounded, 15000), JSON.stringify((await state()).p));
  await sleep(3200); // let the level banner fade
  await shot('02-level1-start');

  // ---- movement: walk forward with real keyboard input ----
  const s0 = await state();
  await page.keyboard.down('KeyW');
  await waitFor(async () => (await state()).p[2] < -0.5, 15000, 50);
  await page.keyboard.up('KeyW');
  await sleep(300);
  const s1 = await state();
  check('W moves the player forward (-Z)', s1.p[2] < s0.p[2] - 2, `z ${s0.p[2].toFixed(2)} -> ${s1.p[2].toFixed(2)}`);
  check('player stays grounded while walking', s1.grounded);

  // ---- real platforming: walk to the edge and jump the first gap onto island A ----
  await page.keyboard.down('KeyW');
  // Press jump on the exact frame the player nears the edge (polling from Node is too coarse).
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const j = window.__jumpbound;
        const loop = () => {
          if (j.playerState.position.z < -5.1) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            setTimeout(() => {
              window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
              resolve();
            }, 600);
          } else requestAnimationFrame(loop);
        };
        loop();
      }),
  );
  const landed = await waitFor(async () => {
    const s = await state();
    return s.grounded && s.p[2] < -8.4;
  }, 15000, 50);
  await page.keyboard.up('KeyW');
  const sA = await state();
  check('jumping the first gap lands on island A', landed && !sA.dead, `pos ${sA.p.map((v) => v.toFixed(2))}`);
  check('crystals along the path are collected', sA.crystals >= 3 && sA.crystals <= 10, `crystals=${sA.crystals}`);

  // ---- Restart Level resets the run ----
  await game('j.getGame().restartLevel()');
  check('restart resets crystals and lives', await waitFor(async () => {
    const s = await state();
    return s.crystals === 0 && s.lives === 3 && s.health === 3 && s.grounded;
  }, 20000), JSON.stringify(await state()));
  await sleep(2000);

  // ---- jump ----
  const yBefore = (await state()).p[1];
  await page.keyboard.down('Space');
  let peak = yBefore;
  for (let i = 0; i < 12; i++) {
    await sleep(60);
    peak = Math.max(peak, (await state()).p[1]);
  }
  await page.keyboard.up('Space');
  check('Space makes the player jump', peak > yBefore + 1.2, `peak +${(peak - yBefore).toFixed(2)}`);
  check('player lands again after a jump', await waitFor(async () => (await state()).grounded, 6000));
  await shot('03-after-jump');

  // ---- stomping a Forest Wanderer ----
  await sleep(1500);
  const wander = await game('Object.entries(j.enemies()).find(([, e]) => e.type === "wanderer")');
  let stomped = false;
  if (wander) {
    for (let attempt = 0; attempt < 3 && !stomped; attempt++) {
      const e = (await game('j.enemies()'))[wander[0]];
      if (!e) break;
      // Aim slightly ahead of the walker so it moves underneath the falling player.
      await game(`j.playerApi.teleport([${e.x + e.vx * 0.25}, ${e.y + 1.2}, ${e.z + e.vz * 0.25}])`);
      stomped = await waitFor(async () => (await game('j.getGame().enemiesDefeated')) > 0, 3000, 30);
      if (!stomped) await sleep(1600);
    }
  }
  check('stomping a Forest Wanderer defeats it', stomped);

  // ---- pause freezes the simulation ----
  await page.keyboard.press('Escape');
  check('Esc pauses', await waitFor(async () => (await state()).screen === 'paused', 3000));
  const tPause = (await state()).t;
  await sleep(1000);
  check('game clock frozen while paused', Math.abs((await state()).t - tPause) < 1e-6);
  await shot('04-pause');
  await page.keyboard.press('Escape');
  check('Esc resumes', await waitFor(async () => (await state()).screen === 'playing', 3000));

  // ---- hazard damage ----
  const hBefore = (await state()).health;
  await game('j.playerApi.teleport([2.7, 0, -13.6])');
  check('spikes damage the player', await waitFor(async () => (await state()).health < hBefore, 5000));

  // ---- checkpoint ----
  await sleep(1600); // invulnerability window
  await game('j.playerApi.teleport([2.6, 1.6, -45.6])');
  check('touching a wayshrine activates the checkpoint', await waitFor(async () => (await state()).cp === 0, 5000));
  await sleep(600);
  await shot('05-checkpoint');

  // ---- falling into the void costs a life and respawns at the checkpoint ----
  const livesBefore = (await state()).lives;
  await game('j.playerApi.teleport([30, 0, -45])');
  check('falling loses a life', await waitFor(async () => (await state()).lives === livesBefore - 1, 12000));
  const respawned = await waitFor(async () => {
    const s = await state();
    return !s.dead && Math.hypot(s.p[0] - 2.6, s.p[2] + 45.6) < 1.5;
  }, 6000);
  check('respawn at the activated checkpoint', respawned, JSON.stringify((await state()).p));

  // ---- portal -> victory ----
  await sleep(2400);
  await game('j.playerApi.teleport([0, 4.6, -91.2])');
  check('portal completes the level', await waitFor(async () => (await state()).screen === 'victory', 12000));
  await sleep(800);
  await shot('06-victory');
  check('progress unlocks level 2', await game('j.getGame().progress.unlocked >= 2'));

  // ---- next level ----
  const [nextBtn] = await page.$$('xpath/.//button[contains(., "Next Level")]');
  await nextBtn.click();
  check('Next Level loads Crystal Canyon', await waitFor(async () => {
    const s = await state();
    return s.screen === 'playing' && s.level === 1;
  }, 8000));
  check('level 2 player grounded', await waitFor(async () => (await state()).grounded, 15000));
  await sleep(3200);
  await shot('07-level2');
  // ride the first moving platform for a while
  await game('j.playerApi.teleport([0, 0.8, -28.5])');
  await sleep(1500);
  await shot('08-level2-mover');

  // ---- level 3 ----
  await game('j.getGame().startLevel(2)');
  check('Sky Temple loads', await waitFor(async () => (await state()).level === 2 && (await state()).grounded, 15000));
  await sleep(3200);
  await shot('09-level3');
  await game('j.playerApi.teleport([0, 1.6, -33])');
  await sleep(800);
  await shot('10-level3-sweeper');
  await game('j.playerApi.teleport([9.5, 11.4, -106])');
  await sleep(1500);
  await game('j.playerApi.teleport([9.5, 11.4, -107.4])');
  check('final portal completes the game', await waitFor(async () => (await state()).screen === 'victory', 30000));
  await sleep(800);
  await shot('11-final-victory');
  check('final result flagged', await game('j.getGame().result.final === true'));

  // ---- Crystal Guardian charges at an intruder ----
  await game('j.getGame().startLevel(1)');
  await waitFor(async () => (await state()).grounded, 15000);
  await sleep(1000);
  await game('j.playerApi.teleport([0, 5.8, -67.2])');
  await sleep(2500); // respawn invulnerability is short for teleports
  const sawCharge = await waitFor(async () => {
    const g = Object.values(await game('j.enemies()')).find((e) => e.type === 'guardian');
    return g && (g.mode === 'alert' || g.mode === 'dash');
  }, 8000, 30);
  check('Crystal Guardian telegraphs and charges', sawCharge);
  check('Crystal Guardian charge damages the player', await waitFor(async () => (await state()).health < 3, 10000));
  await shot('11b-guardian');

  // ---- game over ----
  await game('j.getGame().startLevel(0)');
  await waitFor(async () => (await state()).grounded, 15000);
  for (let i = 0; i < 3; i++) {
    const lives = (await state()).lives;
    await game('j.playerApi.teleport([40, 0, 0])');
    await waitFor(async () => {
      const s = await state();
      return s.lives < lives || s.screen === 'gameover';
    }, 15000);
    await waitFor(async () => {
      const s = await state();
      return s.screen === 'gameover' || (!s.dead && s.grounded);
    }, 15000);
  }
  check('losing all lives shows game over', await waitFor(async () => (await state()).screen === 'gameover', 10000));
  await sleep(500);
  await shot('12-gameover');
  const [retryBtn] = await page.$$('xpath/.//button[contains(., "Retry")]');
  await retryBtn.click();
  check('Retry restarts with full lives', await waitFor(async () => {
    const s = await state();
    return s.screen === 'playing' && s.lives === 3;
  }, 6000));

  // ---- menus ----
  await page.keyboard.press('Escape');
  await waitFor(async () => (await state()).screen === 'paused', 3000);
  const [settingsBtn] = await page.$$('xpath/.//button[contains(., "Settings")]');
  await settingsBtn.click();
  await sleep(500);
  await shot('13-settings');
  const [lowBtn] = await page.$$('xpath/.//button[@role="radio" and contains(., "Low")]');
  await lowBtn.click();
  check('quality setting applied & persisted', await page.evaluate(() => JSON.parse(localStorage.getItem('jumpbound.settings.v1')).quality === 'low'));
  await page.keyboard.press('Escape');
  await sleep(300);
  const [menuBtn] = await page.$$('xpath/.//button[contains(., "Main Menu")]');
  await menuBtn.click();
  check('Main Menu button returns to menu', await waitFor(async () => (await state()).screen === 'menu', 4000));
  await sleep(1500);
  const [levelsBtn] = await page.$$('xpath/.//button[contains(., "Levels")]');
  await levelsBtn.click();
  await sleep(500);
  await shot('14-level-select');
  check('all three levels unlocked after completion', await page.evaluate(() => document.querySelectorAll('.level-card:not([disabled])').length === 3));

  const relevant = errors.filter((e) => !/GPU stall|WebGL.*performance|swiftshader|ReadPixels|Automatic fallback to software/i.test(e));
  check('no console errors or warnings', relevant.length === 0, relevant.slice(0, 8).join(' | '));
} catch (err) {
  check('smoke test crashed', false, err.stack || String(err));
} finally {
  await browser?.close();
  server.kill();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
}

console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} checks passed. Screenshots: scripts/.shots/`);
process.exit(failures ? 1 : 0);
