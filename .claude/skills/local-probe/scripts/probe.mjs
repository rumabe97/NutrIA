// Opens pages of the local build in a real Chrome and says what a person would notice.
//
// Usage: node probe.mjs --paths /acceder,/registro [options]
//   --dir <dir>          where screenshots go, and where playwright-core is installed
//                        (default: $PROBE_DIR or $TMPDIR/nutria-probe)
//   --base <url>         default http://localhost:3000
//   --views a,b          of narrow (320), small (360), phone (390), tablet (768), desktop (1280);
//                        default narrow, phone, desktop
//   --schemes a,b        of light, dark; default both
//   --themes a,b         of auto, claro, oscuro, huerta, pulso, contraste (`0106`): the choice is
//                        put on the device before the page loads, as the switch would keep it;
//                        default auto (nothing stored)
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
  small: { deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: { height: 740, width: 360 } },
  tablet: { deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: { height: 1024, width: 768 } },
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
const themes = list(option('themes', 'auto'));
const THEMES = ['auto', 'claro', 'oscuro', 'huerta', 'pulso', 'contraste'];
const cookieFile = option('cookie-file', undefined);

if (paths.length === 0 || views.some(view => !VIEWS[view]) || themes.some(theme => !THEMES.includes(theme))) {
  console.error(
    'usage: node probe.mjs --paths /a,/b [--dir d] [--views narrow,small,phone,tablet,desktop] [--schemes light,dark] [--themes auto,claro,…] [--cookie-file f] [--dismiss] [--viewport-only]'
  );
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
    for (const theme of themes) {
    for (const scheme of schemes) {
      const context = await browser.newContext({ ...VIEWS[view], colorScheme: scheme });

      await context.addCookies(cookies);

      // The choice the switch keeps, on the device before the first byte — so the inline script
      // paints it, exactly as a returning visit would.
      if (theme !== 'auto') {
        await context.addInitScript(value => window.localStorage.setItem('nutria-theme', value), theme);
      }

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

        // Element by element, what runs past the screen or is cut by its own box (`apps/web/AGENTS.md`
        // § Large text): a box whose right edge is past the viewport, or a box that clips more than a
        // pixel of its own content sideways. Not counted: anything inside a box that scrolls
        // sideways on purpose (a table's scroller, a chip rail), what is visually hidden on purpose
        // (1px clip-path / clip boxes, the skip link off-screen), and text cut with an ellipsis,
        // which is a decision rather than an accident.
        const width = document.documentElement.clientWidth;
        const scrolls = node => {
          for (let up = node.parentElement; up && up !== document.body; up = up.parentElement) {
            const x = getComputedStyle(up).overflowX;

            if (x === 'auto' || x === 'scroll') return true;
          }

          return false;
        };
        const hiddenOnPurpose = node => {
          for (let up = node; up && up !== document.body; up = up.parentElement) {
            const style = getComputedStyle(up);
            const box = up.getBoundingClientRect();

            if (style.clipPath === 'inset(50%)' || style.clip.startsWith('rect(0') || (box.width <= 1 && box.height <= 1)) return true;
            if (style.position === 'fixed' || style.position === 'absolute') {
              if (box.right <= 0 || box.left >= width || box.bottom <= 0) return true;
            }
            if (style.visibility === 'hidden' || style.display === 'none') return true;
          }

          return false;
        };
        const label = node => `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? '.' + node.className.split(' ')[0].replace(/_[a-z0-9]+__.*$/i, '') : ''} "${(node.textContent ?? '').trim().slice(0, 40)}"`;
        const runs = [];
        const cut = [];

        for (const node of document.body.querySelectorAll('*')) {
          if (!visible(node) || node.closest('svg') && node.tagName.toLowerCase() !== 'svg' || scrolls(node) || hiddenOnPurpose(node)) continue;

          const box = node.getBoundingClientRect();
          const style = getComputedStyle(node);

          if (box.right > width + 1 || box.left < -1) runs.push(`${label(node)} ${Math.round(box.left)}→${Math.round(box.right)}`);

          const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';

          if (clipsX && style.textOverflow !== 'ellipsis' && node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0) {
            cut.push(`${label(node)} ${node.scrollWidth}>${node.clientWidth}`);
          }
        }

        return {
          runs: runs.slice(0, 6),
          cut: cut.slice(0, 6),
          h1: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()),
          // The document's own scroll misses content that is *clipped* rather than scrolled:
          // `html`/`body` carry `overflow-x: clip`, so a block wider than the screen cuts its
          // words off and `documentElement.scrollWidth` never moves. `body.scrollWidth` still
          // reports what the content asked for, and a table with its own scroller does not
          // reach it. The wider of the two is the honest answer.
          overflow: Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.documentElement.clientWidth
          ),
          small
        };
      }, TARGET_MIN);

      const status = response?.status() ?? 0;
      const landed = new URL(page.url()).pathname;
      const name = `${path.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home'}-${view}-${theme === 'auto' ? '' : `${theme}-`}${scheme}.png`;
      const bad = status >= 400 || seen.overflow > 0 || seen.runs.length > 0 || seen.cut.length > 0 || complaints.some(line => line.startsWith('threw'));

      // A full-page screenshot is taken without scrolling, and the landing page reveals its
      // sections as they are scrolled into view — so an unscrolled capture shows a page that is
      // two thirds blank, which looks exactly like hydration having failed. Walk the page first.
      if (!flag('viewport-only')) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);

        for (let y = 0; y <= height; y += 500) {
          await page.evaluate(top => window.scrollTo(0, top), y);
          await page.waitForTimeout(80);
        }

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
      }

      const stillHidden = await page.$$eval('[data-reveal="hidden"]', nodes => nodes.length);

      if (stillHidden > 0) complaints.push(`${stillHidden} reveal block(s) still hidden after the whole page was scrolled — the observer did not run`);

      await page.screenshot({ fullPage: !flag('viewport-only'), path: join(shots, name) });

      failed ||= bad;
      console.log(
        `${bad ? 'FAIL' : 'ok  '} ${path} · ${view} · ${theme} · ${scheme} · ${status}${landed === path ? '' : ` → ${landed}`} · overflow ${seen.overflow}px · runs ${seen.runs.length} · cut ${seen.cut.length} · h1 ${JSON.stringify(seen.h1)}`
      );

      for (const line of seen.runs) console.log(`     runs past the screen: ${line}`);
      for (const line of seen.cut) console.log(`     cut by its own box: ${line}`);

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
}

await browser.close();
console.log(`[probe] screenshots in ${shots} — look at them: a green line says the page fits, not that it is right`);
process.exit(failed ? 1 : 0);
