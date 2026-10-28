// Visual check: the hero picker with its 3D preview (all five heroes, clicked like a player would),
// then each hero in-game and the Level 3 opening.
//   npm run build && node scripts/shots-characters.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const PORT = 4180;
const SHOTS = fileURLToPath(new URL('./.shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const executablePath = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p));

const HEROES = ['wren', 'kiko', 'mira', 'pip', 'nori'];
const NAMES = { wren: 'Wren', kiko: 'Kiko', mira: 'Mira', pip: 'Pip', nori: 'Nori' };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true });
const errors = [];
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await sleep(4000);

  // Fresh player: Play opens the hero picker.
  const [play] = await page.$$('xpath/.//button[contains(., "Play")]');
  await play.click();
  await sleep(2500);
  const opened = await page.evaluate(() => window.__jumpbound.getGame().panel === 'characters');
  console.log(`${opened ? 'PASS' : 'FAIL'}  Play on a fresh save opens the character select`);

  for (const id of HEROES) {
    const [card] = await page.$$(`xpath/.//button[@role="radio" and contains(@aria-label, "${NAMES[id]}")]`);
    if (!card) {
      console.log(`FAIL  no card for ${id}`);
      continue;
    }
    await card.click();
    await sleep(1800);
    await page.screenshot({ path: `${SHOTS}20-picker-${id}.png` });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jumpbound.settings.v1')).character);
    console.log(`${saved === id ? 'PASS' : 'FAIL'}  hero "${id}" chosen in picker and persisted`);
  }

  // The picker's own start button should begin the game with the last chosen hero.
  const [start] = await page.$$('xpath/.//button[contains(., "Start Adventure")]');
  await start.click();
  await sleep(4500);
  for (const id of ['pip', 'nori']) {
    await page.evaluate((cid) => {
      const g = window.__jumpbound.getGame();
      g.updateSettings({ character: cid });
      g.startLevel(0);
    }, id);
    await sleep(4500);
    await page.evaluate(() => {
      window.__jumpbound.playerState.facing = 0;
    });
    await sleep(1200);
    await page.screenshot({ path: `${SHOTS}21-ingame-${id}.png` });
  }

  await page.evaluate(() => window.__jumpbound.getGame().startLevel(2));
  await sleep(5000);
  await page.screenshot({ path: `${SHOTS}22-level3-start.png` });
  console.log(errors.length ? `FAIL  console errors: ${errors.slice(0, 5).join(' | ')}` : 'PASS  no console errors');
} finally {
  await browser?.close();
  server.kill();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
}
process.exit(errors.length ? 1 : 0);
