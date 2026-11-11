// Every width from 320 to 1400 in steps: does the page scroll sideways anywhere in between the named views?
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
const [dir, cookieFile, ...paths] = process.argv.slice(2);
const { chromium } = createRequire(dir + '/noop.js')('playwright-core');
const exe = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const cookies = cookieFile === '-' ? [] : readFileSync(cookieFile, 'utf8').trim().split('; ').map(p => ({ domain: 'localhost', name: p.slice(0, p.indexOf('=')), path: '/', value: p.slice(p.indexOf('=') + 1) }));
const browser = await chromium.launch({ executablePath: exe, headless: true });
let bad = 0;
for (const path of paths) {
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto('http://localhost:3000' + path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => undefined);
  await page.keyboard.press('Escape');
  const hits = [];
  for (let width = 320; width <= 1400; width += 16) {
    await page.setViewportSize({ width, height: 900 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) hits.push(`${width}px +${over}`);
  }
  bad += hits.length;
  console.log(hits.length === 0 ? 'ok  ' : 'FAIL', path, hits.join(', '));
  await context.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
