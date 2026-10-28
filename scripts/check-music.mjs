// Checks that the licensed music loads in a real browser: menu track, then an island track.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const PORT = 4182;
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true });
const warnings = [];
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* not up */ }
    await sleep(300);
  }
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1000, height: 600 } });
  const page = await browser.newPage();
  page.on('console', (m) => ['warning', 'error'].includes(m.type()) && warnings.push(m.text()));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await sleep(3000);
  const status = await page.evaluate(() => fetch('/assets/music/menu-a-brand-new-wisdom.ogg').then((r) => r.status));
  console.log('menu track HTTP status:', status);
  await page.mouse.click(500, 300); // first user gesture unlocks audio
  await sleep(2500);
  await page.evaluate(() => window.__jumpbound.getGame().startLevel(1));
  await sleep(4000);
  await page.evaluate(() => window.__jumpbound.getGame().startLevel(3));
  await sleep(4000);
  console.log(warnings.some((w) => w.includes('Music file unavailable')) ? 'FAIL: a music file failed to load' : 'PASS: no music load failures');
  console.log('warnings:', warnings.length ? warnings.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser?.close();
  server.kill();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
}
process.exit(0);
