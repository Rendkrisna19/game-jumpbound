// Debug: does real keyboard input move the hero on each level?
//   npm run build && node scripts/debug-controls.mjs [levelIndex]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const PORT = 4181;
const LEVEL = Number(process.argv[2] ?? 1);
const executablePath = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find((p) => existsSync(p));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true });
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
    defaultViewport: { width: 1280, height: 720 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await sleep(3000);
  await page.evaluate((idx) => {
    const g = window.__jumpbound.getGame();
    g.updateSettings({ character: 'wren' });
    g.startLevel(idx);
  }, LEVEL);
  await sleep(4000);
  const st = () =>
    page.evaluate(() => {
      const j = window.__jumpbound;
      return {
        screen: j.getGame().screen,
        level: j.getGame().levelIndex,
        pos: j.playerState.position.toArray().map((v) => +v.toFixed(2)),
        vel: j.playerState.velocity.toArray().map((v) => +v.toFixed(2)),
        grounded: j.playerState.grounded,
        dead: j.playerState.dead,
        panel: j.getGame().panel,
        active: document.activeElement?.tagName,
      };
    });
  console.log('start', JSON.stringify(await st()));

  if (process.env.MOVERS) {
    // Stand on each moving platform in turn and check that the hero still responds to input.
    const spots = JSON.parse(process.env.MOVERS);
    for (const id of spots) {
      // Stand on the platform where it is right now, then steer with D.
      const spot = await page.evaluate((mid) => {
        const p = window.__jumpbound.movers()[mid];
        return p ? [p[0], p[1], p[2]] : null;
      }, id);
      if (!spot) {
        console.log(`no mover ${id}`);
        continue;
      }
      await page.evaluate((p) => window.__jumpbound.playerApi.teleport(p), spot);
      await sleep(1500);
      const before = await st();
      await page.keyboard.down('KeyD');
      await sleep(900);
      await page.keyboard.up('KeyD');
      await sleep(200);
      const after = await st();
      const dx = after.pos[0] - before.pos[0];
      console.log(`mover ${id} at ${JSON.stringify(spot.map((v) => +v.toFixed(1)))}: D moved dx=${dx.toFixed(2)} grounded=${after.grounded} ${JSON.stringify(after.pos)}`);
    }
  }
  if (process.env.WALK) {
    // Walk forward for a while and log whether the hero keeps responding.
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 14; i++) {
      await sleep(700);
      console.log(`t${i}`, JSON.stringify(await st()));
    }
    await page.keyboard.up('KeyW');
  }
  for (const key of ['KeyW', 'KeyD', 'KeyA', 'KeyS', 'ArrowUp']) {
    const before = await st();
    await page.keyboard.down(key);
    await sleep(900);
    await page.keyboard.up(key);
    await sleep(200);
    const after = await st();
    const moved = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]);
    console.log(`${key}: moved ${moved.toFixed(2)}  ${JSON.stringify(after)}`);
  }
  await page.screenshot({ path: 'scripts/.shots/debug-level' + LEVEL + '.png' });
} finally {
  await browser?.close();
  server.kill();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
}
process.exit(0);
