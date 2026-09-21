// Opens pages of the local build in a real Chrome and says what a person would notice.
//
// Usage: node probe.mjs --paths /acceder,/registro [options]
//   --dir <dir>          where screenshots go, and where playwright-core is installed
//                        (default: $PROBE_DIR or $TMPDIR/nutria-probe)
//   --base <url>         default http://localhost:3000
//   --views a,b          of narrow (320), phone (390), desktop (1280); default all three
//   --schemes a,b        of light, dark; default both
//   --cookie-file <f>    a session from account.mjs, for the signed-in screens
//   --dismiss            press Escape after load — a new account opens the welcome tour,
//                        which sits over everything
//   --viewport-only      screenshot the first screen instead of the whole page
//
// Every page gets a fresh browser context. A shared one carries the language cookie from
// `/en/…` into the next page, and the proxy then redirects a Spanish URL to its English
// twin — which reads like a bug in the page and is a bug in the probe.
//
// Exits 1 when a page answers 4xx/5xx, scrolls sideways, or throws. Small touch targets
// and console errors are printed as hints: both need a person's judgement.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VIEWS = {
  desktop: { deviceScaleFactor: 1, viewport: { height: 900, width: 1280 } },
  narrow: { deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: { height: 700, width: 320 } },
  phone: { deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } }
};
const CHROMES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const TARGET_MIN = 44;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const flag = name => process.argv.includes(`--${name}`);
const list = value => value.split(',').map(item => item.trim()).filter(Boolean);

const dir = option('dir', process.env.PROBE_DIR ?? join(tmpdir(), 'nutria-probe'));
const base = option('base', 'http://localhost:3000');
const paths = list(option('paths', ''));
const views = list(option('views', 'narrow,phone,desktop'));
const schemes = list(option('schemes', 'light,dark'));
const cookieFile = option('cookie-file', undefined);

if (paths.length === 0 || views.some(view => !VIEWS[view])) {
  console.error('usage: node probe.mjs --paths /a,/b [--dir d] [--views narrow,phone,desktop] [--schemes light,dark] [--cookie-file f] [--dismiss] [--viewport-only]');
  process.exit(2);
}

let chromium;

try {
  ({ chromium } = createRequire(join(dir, 'noop.js'))('playwright-core'));
} catch {
  console.error(`[probe] playwright-core is not installed in ${dir}. Once per scratchpad:\n        npm install --prefix "${dir}" --no-save playwright-core`);
  process.exit(2);
}

const executablePath = CHROMES.find(path => path && existsSync(path));
const shots = join(dir, 'shots');

mkdirSync(shots, { recursive: true });

// The session cookie is written by the API on localhost:3001; a cookie ignores the port,
// which is what makes the web app on :3000 see it.
const cookies = cookieFile
  ? readFileSync(cookieFile, 'utf8')
      .split('; ')
      .map(pair => ({ domain: 'localhost', name: pair.slice(0, pair.indexOf('=')), path: '/', value: pair.slice(pair.indexOf('=') + 1) }))
  : [];

const browser = await chromium.launch({ executablePath, headless: true });
let failed = false;

for (const path of paths) {
  for (const view of views) {
    for (const scheme of schemes) {
      const context = await browser.newContext({ ...VIEWS[view], colorScheme: scheme });

      await context.addCookies(cookies);

      const page = await context.newPage();
      const complaints = [];

      page.on('pageerror', error => complaints.push(`threw: ${error.message}`));
      page.on('console', message => message.type() === 'error' && complaints.push(`console: ${message.text().slice(0, 160)}`));

      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });

      if (flag('dismiss')) {
        await page.keyboard.press('Escape');
      }

      const seen = await page.evaluate(min => {
        const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
        // What a finger hits, not what is painted: a compact control may keep its height
        // and grow its target with an absolutely placed pseudo-element (`0057`).
        const hitHeight = node => {
          const box = node.getBoundingClientRect().height;
          const grown = ['::before', '::after'].map(pseudo => {
            const style = getComputedStyle(node, pseudo);
            const [top, bottom] = [parseFloat(style.top), parseFloat(style.bottom)];

            return style.content !== 'none' && style.position === 'absolute' && Number.isFinite(top) && Number.isFinite(bottom) ? box - top - bottom : 0;
          });

          // A control inside a `<label>` is as tall as the label: the whole line is what is
          // pressed — a radio, a checkbox, a switch in a settings row.
          const wrapper = node.closest('label');

          return Math.round(Math.max(box, wrapper?.getBoundingClientRect().height ?? 0, ...grown));
        };
        const describe = node => {
          const kind = node.tagName.toLowerCase() + `[${node.getAttribute('role') ?? node.getAttribute('type') ?? ''}]`.replace('[]', '');
          const labelledBy = node.getAttribute('aria-labelledby');
          const named = labelledBy ? document.getElementById(labelledBy.split(' ')[0])?.textContent : (node.labels?.[0]?.textContent ?? null);
          const words = node.textContent?.trim() || node.getAttribute('aria-label') || named?.trim() || node.getAttribute('name') || '(no name)';

          return `${kind} ${words}`.trim().slice(0, 48);
        };
        const small = [...document.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea')]
          .filter(visible)
          .map(node => ({ height: hitHeight(node), label: describe(node) }))
          .filter(target => target.height < min);

        return {
          h1: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          small
        };
      }, TARGET_MIN);

      const status = response?.status() ?? 0;
      const landed = new URL(page.url()).pathname;
      const name = `${path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home'}-${view}-${scheme}.png`;
      const bad = status >= 400 || seen.overflow > 0 || complaints.some(line => line.startsWith('threw'));

      await page.screenshot({ fullPage: !flag('viewport-only'), path: join(shots, name) });

      failed ||= bad;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${path} · ${view} · ${scheme} · ${status}${landed === path ? '' : ` → ${landed}`} · overflow ${seen.overflow}px · h1 ${JSON.stringify(seen.h1)}`);

      // A finger's target only matters where there is a finger, and once per page is enough.
      if (VIEWS[view].hasTouch && scheme === schemes[0] && seen.small.length > 0) {
        console.log(`     hint: under ${TARGET_MIN}px on touch — ${seen.small.map(target => `"${target.label}" ${target.height}px`).join(', ')}`);
      }

      for (const line of new Set(complaints)) {
        console.log(`     hint: ${line}`);
      }

      await context.close();
    }
  }
}

await browser.close();
console.log(`[probe] screenshots in ${shots} — look at them: a green line says the page fits, not that it is right`);
process.exit(failed ? 1 : 0);
