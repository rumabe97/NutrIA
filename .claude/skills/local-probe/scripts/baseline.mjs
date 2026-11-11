// What a person can reach on a screen, as a sorted list a later run can be diffed against.
//
// Usage: node baseline.mjs --out <dir> --state <name> --paths /a,/b [options]
//   --dir <dir>          where playwright-core is installed (default: $PROBE_DIR)
//   --base <url>         default http://localhost:3000
//   --cookie-file <f>    a session from account.mjs
//   --locales a,b        of es-ES, en-GB; default both (the `nutria_locale` cookie)
//   --views a,b          of phone (390), desktop (1280); default both
//   --dismiss            press Escape after load (the welcome tour)
//
// One file per path, state, locale and view: `<path>.<state>.<locale>.<view>.txt`, holding
// every heading and every interactive element by role and accessible name, sorted and
// de-duplicated, digits replaced by `#` so a date or a count is not a difference. A line
// that disappears between two runs is a control somebody lost, or a rename to explain.
//
// It reads the accessibility tree, not the markup: a control that is there but has no name,
// or is hidden from assistive technology, is not in the file — which is what a person using
// one would find too.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VIEWS = {
  desktop: { viewport: { height: 900, width: 1280 } },
  phone: { hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } }
};
const CHROMES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
/** The roles a person operates or navigates by. Text, images and structure are the inventory's, not this file's. */
const KEPT =
  /^(button|checkbox|combobox|heading|link|listbox|menuitem|menuitemcheckbox|menuitemradio|option|radio|searchbox|slider|spinbutton|switch|tab|textbox)\b/;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const list = value =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const dir = option('dir', process.env.PROBE_DIR ?? join(tmpdir(), 'nutria-probe'));
const base = option('base', 'http://localhost:3000');
const out = option('out', undefined);
const state = option('state', undefined);
const paths = list(option('paths', ''));
const locales = list(option('locales', 'es-ES,en-GB'));
const views = list(option('views', 'phone,desktop'));
const cookieFile = option('cookie-file', undefined);

if (!out || !state || paths.length === 0 || views.some(view => !VIEWS[view])) {
  console.error('usage: node baseline.mjs --out <dir> --state <name> --paths /a,/b [--cookie-file f] [--locales es-ES,en-GB] [--views phone,desktop] [--dismiss]');
  process.exit(2);
}

let chromium;

try {
  ({ chromium } = createRequire(join(dir, 'noop.js'))('playwright-core'));
} catch {
  console.error(`[baseline] playwright-core is not installed in ${dir}. Once per scratchpad:\n           npm install --prefix "${dir}" --no-save playwright-core`);
  process.exit(2);
}

mkdirSync(out, { recursive: true });

const session = cookieFile
  ? readFileSync(cookieFile, 'utf8')
      .trim()
      .split('; ')
      .map(pair => ({ domain: 'localhost', name: pair.slice(0, pair.indexOf('=')), path: '/', value: pair.slice(pair.indexOf('=') + 1) }))
  : [];

/** `- button "Enviar" [disabled]` → `button "Enviar" [disabled]`, with digits flattened; lines of other roles dropped. */
function lines(snapshot) {
  const kept = new Set();

  for (const raw of snapshot.split('\n')) {
    const line = raw
      .trim()
      .replace(/^- /, '')
      .replace(/:$/, '')
      .replace(/\[ref=[^\]]*\]/g, '')
      .trim();

    if (KEPT.test(line)) {
      kept.add(line.replace(/\d+([.,]\d+)*/g, '#'));
    }
  }

  return [...kept].sort((a, b) => a.localeCompare(b));
}

const browser = await chromium.launch({ executablePath: CHROMES.find(path => path && existsSync(path)), headless: true });
let failed = false;

for (const path of paths) {
  for (const locale of locales) {
    for (const view of views) {
      const context = await browser.newContext({ ...VIEWS[view], locale });

      await context.addCookies([...session, { domain: 'localhost', name: 'nutria_locale', path: '/', value: locale }]);

      const page = await context.newPage();
      const response = await page.goto(`${base}${path}`, { waitUntil: 'load' });

      // A page that keeps a request open (a poll, a worker) never goes idle: wait for quiet, but not forever.
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);

      if (process.argv.includes('--dismiss')) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      const found = lines(await page.locator('body').ariaSnapshot());
      const name = `${path.replace(/^\//, '').replace(/[0-9a-f-]{36}/g, 'id').replace(/\//g, '_') || 'root'}.${state}.${locale}.${view}.txt`;
      const landed = new URL(page.url()).pathname;
      const header = `# ${path.replace(/[0-9a-f-]{36}/g, "<id>")} · ${state} · ${locale} · ${view} · ${response?.status() ?? '?'}${landed === path ? '' : ` → ${landed.replace(/[0-9a-f-]{36}/g, '<id>')}`}`;

      writeFileSync(join(out, name), `${header}\n${found.join('\n')}\n`);
      console.log(`${String(found.length).padStart(4)} ${name}`);

      if ((response?.status() ?? 0) >= 500) {
        failed = true;
      }

      await context.close();
    }
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
