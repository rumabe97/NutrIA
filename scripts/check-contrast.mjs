// Every theme keeps its words and its controls legible — measured, not eyeballed (`0106` § 8).
//
// Usage: node scripts/check-contrast.mjs [--file <themes.css>]
//
// Reads the app's themes file, resolves each token's `var()` chain inside each theme, and
// computes the WCAG 2 contrast ratio of every foreground/background pair declared below.
// Fails when a pair falls under its floor in any theme: 4.5:1 for text, 3:1 for display
// text, for a control's edge and for a focus ring. A translucent colour is composited on
// what it sits on first, the way the screen does.
//
// It also fails when the file is out of shape, because a theme that is missing a token is a
// theme that silently falls back to another one's colour:
//   - a theme lacks a token another theme defines, or names no `color-scheme`;
//   - an Automático block is not exactly the theme it stands for: the light device's (no
//     attribute), the dark device's (`prefers-color-scheme: dark`) and the one a device asking
//     for more contrast gets (`prefers-contrast: more`);
//   - the `forced-colors: active` block is missing, leaves a token out, or gives one anything
//     but a system colour (or `none`, `transparent`, a number, a length);
//   - a pair names a token no theme defines, or a value this script cannot read.
//
// A pair's ground may be a stack, bottom first — a highlighted row on a translucent menu is
// `['--color-glass', '--color-highlighted']` — and each layer is painted on the one below.
//
// A pair that fails TODAY, in today's design, is not fixed here: it is listed in KNOWN_TODAY
// with the ratio it measured, so it cannot get worse and so a later phase knows what it has
// to clear. An entry that passes is stale and fails too, so the list only ever shrinks.
//
// Plain Node, no dependency. CI runs it beside the static-pages check; `gate.sh --full` too.
import { readFileSync } from 'node:fs';

const fileFlag = process.argv.indexOf('--file');
const file = fileFlag === -1 ? new URL('../apps/web/src/styles/themes.css', import.meta.url) : process.argv[fileFlag + 1];

/** Which theme Automático shows, by what the device asks for. */
const AUTO = { contrast: 'contraste', dark: 'oscuro', light: 'claro' };

// `mark`: a ring's colour against what it is drawn on (WCAG 1.4.11). `chart`: a chart's mark,
// held to 4.5:1 in every theme — what `prefers-contrast: more` used to raise the chart colours
// to (`0069`), so a theme needs no second set for that preference.
const FLOORS = { chart: 4.5, display: 3, edge: 3, mark: 3, ring: 3, text: 4.5 };

/** What a `forced-colors` block may give a token: a CSS system colour, or no colour at all. */
const SYSTEM = /^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext|none|transparent|[\d.]+(?:px)?)$/i;

// The grounds a word or a control sits on. `--color-glass` is translucent: it is measured on
// the page it floats over.
const SURFACES = ['--background-01', '--background-02', '--surface-card', '--surface-sunken', '--color-glass'];
const SOLID_SURFACES = SURFACES.filter(surface => surface !== '--color-glass');

/**
 * The pairs the components actually draw. A new token that carries text, an edge or a ring
 * adds its pairs here in the same change (project 024, § Hand-off).
 */
const PAIRS = [
  // Text on every surface, at every tier.
  ...['--foreground-01', '--foreground-02', '--foreground-03'].flatMap(fg => SURFACES.map(bg => ({ bg, fg, kind: 'text' }))),
  // The accent's text step: tertiary buttons and links on the page and on cards, and a
  // pressed secondary button's label on its wash (ui/Button).
  ...['--background-01', '--surface-card', '--surface-sunken', '--color-brand-03'].map(bg => ({ bg, fg: '--color-brand-11', kind: 'text' })),
  // State text, on the page, on a card and on its own notice's ground.
  ...['--background-01', '--surface-card', '--color-error-surface'].map(bg => ({ bg, fg: '--color-error-text', kind: 'text' })),
  ...['--background-01', '--surface-card', '--color-warning-surface'].map(bg => ({ bg, fg: '--color-warning-text', kind: 'text' })),
  ...['--background-01', '--surface-card', '--surface-sunken'].map(bg => ({ bg, fg: '--color-success-text', kind: 'text' })),
  // A note's words on its own ground (ui/Note): an information note is `--surface-sunken`,
  // already above; a warning and an error have their own.
  ...['--foreground-01', '--foreground-02'].flatMap(fg =>
    ['--color-warning-surface', '--color-error-surface'].map(bg => ({ bg, fg, kind: 'text' }))
  ),
  // The chosen segment of a segmented control (ui/Tabs): the page's colour on the text colour.
  { bg: '--foreground-01', fg: '--background-01', kind: 'text' },
  // A label on a fill: the primary button at both ends of its gradient and under a pointer,
  // and the destructive one.
  { bg: '--color-brand-fill', fg: '--color-on-brand-fill', kind: 'text' },
  { bg: '--color-brand-fill-end', fg: '--color-on-brand-fill', kind: 'text' },
  { bg: '--color-brand-fill-hover', fg: '--color-on-brand-fill', kind: 'text' },
  // The highlighted tile's words.
  { bg: '--color-highlight-fill', fg: '--color-on-highlight-fill', kind: 'text' },
  // The theme switch's menu (ui/ThemeSwitch on ui/Dropdown): every item on the translucent
  // menu, the one under the pointer or the keyboard, and the chosen one's tick.
  ...['--foreground-01', '--foreground-02'].map(fg => ({ bg: ['--color-glass', '--color-highlighted'], fg, kind: 'text' })),
  { bg: '--color-glass', fg: '--color-brand-11', kind: 'text' },
  { bg: '--color-error-fill', fg: '--color-on-error-fill', kind: 'text' },
  // The edge that says where a control is (inputs, secondary buttons, checkboxes, switches).
  ...SOLID_SURFACES.map(bg => ({ bg, fg: '--border-interactive', kind: 'edge' })),
  // A filled control against its ground (a ticked checkbox, a switch that is on, a chosen chip).
  ...SOLID_SURFACES.map(bg => ({ bg, fg: '--color-brand-fill', kind: 'edge' })),
  // The chosen half of a segmented control, on the track and on the card inside it (`0057`).
  ...['--surface-sunken', '--surface-card'].map(bg => ({ bg, fg: '--color-brand-09', kind: 'edge' })),
  // An invalid field's edge.
  ...['--background-01', '--surface-card'].map(bg => ({ bg, fg: '--color-error', kind: 'edge' })),
  // The focus ring, on every solid ground (ui/styles/base).
  ...SOLID_SURFACES.map(bg => ({ bg, fg: '--focus-ring-color', kind: 'ring' })),
  // Progress rings, against their track and against the card around them.
  ...['--color-ring-1', '--color-ring-2', '--color-ring-3', '--color-ring-4'].flatMap(fg =>
    ['--color-ring-track', '--surface-card'].map(bg => ({ bg, fg, kind: 'mark' }))
  ),
  // Chart marks on the card a chart sits in (`0069`), and on the page for a chart that has none.
  ...['1', '2', '3', '4', '5', '6', 'success', 'failure', 'neutral'].flatMap(step =>
    ['--surface-card', '--background-01'].map(bg => ({ bg, fg: `--color-chart-${step}`, kind: 'chart' }))
  )
];

/**
 * Pairs that failed on the day this script was written (project 024, phase 1a, measured on
 * the colours the product had shipped with). Phase 1a changed no colour, by its contract; each
 * entry is for phase 1b to clear, and is removed the day it does. The ratio is the floor it
 * may not fall under meanwhile. Shape: `'<theme> <fg> on <bg>': { ratio, why }`.
 *
 * Empty on that day: every pair above cleared its floor in Claro and in Oscuro. What does not
 * clear 3:1 is not in PAIRS because it is not an edge a control needs — `--border-01` (a
 * divider, 1.26:1, `0041`) and the state colours drawn as the coloured inline-start edge of a
 * note, which project 024 phase 2 removes (PRD criterion 10).
 */
const KNOWN_TODAY = {};

// ── Reading the file ────────────────────────────────────────────────────────────────────

/** Rules as `{ media, selectors, declarations }`, one level of `@media` deep. */
function parse(css, media = null) {
  const rules = [];
  let at = 0;

  while (at < css.length) {
    const open = css.indexOf('{', at);

    if (open === -1) break;

    const prelude = css.slice(at, open).trim();
    let depth = 1;
    let close = open + 1;

    for (; close < css.length && depth > 0; close++) {
      if (css[close] === '{') depth++;
      if (css[close] === '}') depth--;
    }

    const body = css.slice(open + 1, close - 1);

    if (prelude.startsWith('@media')) {
      rules.push(...parse(body, prelude.slice('@media'.length).trim()));
    } else {
      const declarations = {};

      for (const declaration of body.split(';')) {
        const colon = declaration.indexOf(':');

        if (colon !== -1) declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim().replace(/\s+/g, ' ');
      }

      rules.push({ declarations, media, selectors: prelude.split(',').map(selector => selector.trim()) });
    }

    at = close;
  }

  return rules;
}

const rules = parse(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
const themes = {};
const automatic = { contrast: {}, dark: {}, light: {} };
const shared = {};
const forced = {};
const problems = [];
let forcedSeen = false;

for (const { declarations, media, selectors } of rules) {
  const isForced = /^\(\s*forced-colors:\s*active\s*\)$/.test(media ?? '');

  for (const selector of selectors) {
    // A theme answers to `data-theme` on <html> and on any element (a preview of it).
    const named = selector.match(/^(?::root)?\[data-theme='([a-z]+)'\]$/);

    if (named && media === null) Object.assign((themes[named[1]] ??= {}), declarations);
    else if (selector === ':root:not([data-theme])' && media === null) Object.assign(automatic.light, declarations);
    else if (selector === ':root:not([data-theme])' && /^\(\s*prefers-color-scheme:\s*dark\s*\)$/.test(media ?? '')) Object.assign(automatic.dark, declarations);
    else if (selector === ':root:not([data-theme])' && /^\(\s*prefers-contrast:\s*more\s*\)$/.test(media ?? '')) Object.assign(automatic.contrast, declarations);
    else if ((selector === ':root' || selector === '[data-theme]') && media === null) Object.assign(shared, declarations);
    else if ((selector === ':root:not([data-theme])' || selector === '[data-theme]') && isForced) {
      Object.assign(forced, declarations);
      forcedSeen = true;
    } else problems.push(`a rule this script does not know how to read: ${media ? `@media ${media} ` : ''}${selector}`);
  }
}

// ── The file's shape ────────────────────────────────────────────────────────────────────

const names = Object.keys(themes);
const tokensOf = block => Object.keys(block).filter(name => name.startsWith('--'));
const everyToken = [...new Set(names.flatMap(name => tokensOf(themes[name])))];

if (names.length === 0) problems.push(`no theme in ${file}`);

for (const name of names) {
  const missing = everyToken.filter(token => !(token in themes[name]));

  if (missing.length > 0) problems.push(`theme ${name} lacks ${missing.join(', ')}`);
  if (!themes[name]['color-scheme']) problems.push(`theme ${name} names no color-scheme`);
}

for (const [scheme, theme] of Object.entries(AUTO)) {
  if (!themes[theme]) {
    problems.push(`Automático on a ${scheme} device stands for ${theme}, which the file does not define`);
    continue;
  }

  const differ = [...new Set([...Object.keys(automatic[scheme]), ...Object.keys(themes[theme])])].filter(key => automatic[scheme][key] !== themes[theme][key]);

  if (differ.length > 0) problems.push(`Automático on a ${scheme} device is not the ${theme} block: ${differ.join(', ')}`);
}

// Forced colours win over every theme, so every token a theme defines is mapped there, and only
// to what the browser will not repaint.
if (!forcedSeen) problems.push('no @media (forced-colors: active) block for :root:not([data-theme]) and [data-theme]');
else {
  const unmapped = everyToken.filter(token => !(token in forced));
  const wrong = Object.entries(forced).filter(([token, value]) => token.startsWith('--') && !SYSTEM.test(value));

  if (unmapped.length > 0) problems.push(`the forced-colors block leaves out ${unmapped.join(', ')}`);
  if (wrong.length > 0) problems.push(`the forced-colors block gives a non-system value: ${wrong.map(([token, value]) => `${token}: ${value}`).join(', ')}`);
}

// ── Colours ─────────────────────────────────────────────────────────────────────────────

function resolve(token, values, seen = new Set()) {
  if (seen.has(token)) throw new Error(`${token} refers to itself`);
  if (!(token in values)) throw new Error(`${token} is not defined`);

  return values[token].replace(/var\((--[\w-]+)\)/g, (_, inner) => resolve(inner, values, new Set([...seen, token])));
}

/** Splits on the commas at depth 0. */
function args(text) {
  const parts = [''];
  let depth = 0;

  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) parts.push('');
    else parts[parts.length - 1] += char;
  }

  return parts.map(part => part.trim());
}

const number = (text, scale = 1) => (text.endsWith('%') ? (parseFloat(text) / 100) * scale : parseFloat(text));

function hslToRgb(h, s, l) {
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** A colour as `[r, g, b, alpha]`, channels 0–255. */
function colour(text) {
  const value = text.trim().toLowerCase();

  if (value === 'transparent') return [0, 0, 0, 0];
  if (value === 'white') return [255, 255, 255, 1];
  if (value === 'black') return [0, 0, 0, 1];

  const hex = value.match(/^#([0-9a-f]{3,8})$/);

  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g);
    const [r, g, b, a = 'ff'] = digits;

    return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255];
  }

  const fn = value.match(/^([a-z-]+)\((.*)\)$/);

  if (!fn) throw new Error(`cannot read the colour ${text}`);

  const [, name, inner] = fn;

  // CSS Color 5: percentages normalised to a sum of 100%, mixed premultiplied, and a sum
  // under 100% scales the result's alpha.
  if (name === 'color-mix') {
    const [space, first, second] = args(inner);

    if (space !== 'in srgb') throw new Error(`color-mix in ${space} is not supported: ${text}`);

    const part = item => {
      const percentage = item.match(/\s([\d.]+%)$/);

      return { amount: percentage ? number(percentage[1]) : null, colour: colour(percentage ? item.slice(0, -percentage[0].length) : item) };
    };
    const a = part(first);
    const b = part(second);
    const p1 = a.amount ?? (b.amount === null ? 0.5 : 1 - b.amount);
    const p2 = b.amount ?? 1 - p1;
    const sum = p1 + p2;
    const [w1, w2] = [p1 / sum, p2 / sum];
    const alpha = a.colour[3] * w1 + b.colour[3] * w2;
    const channel = i => (alpha === 0 ? 0 : (a.colour[i] * a.colour[3] * w1 + b.colour[i] * b.colour[3] * w2) / alpha);

    return [channel(0), channel(1), channel(2), alpha * Math.min(sum, 1)];
  }

  const parts = inner.includes(',') ? args(inner) : inner.replace('/', ' / ').split(/\s+/).filter(part => part !== '/');
  const alpha = parts[3] === undefined ? 1 : number(parts[3]);

  if (name === 'rgb' || name === 'rgba') return [number(parts[0], 255), number(parts[1], 255), number(parts[2], 255), alpha];
  if (name === 'hsl' || name === 'hsla') return [...hslToRgb(parseFloat(parts[0]), number(parts[1]), number(parts[2])), alpha];

  throw new Error(`cannot read the colour ${text}`);
}

/** `top` painted on an opaque `bottom`. */
const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);

const luminance = rgb =>
  rgb
    .slice(0, 3)
    .map(channel => channel / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

// ── Measuring ───────────────────────────────────────────────────────────────────────────

const rows = [];

for (const name of names) {
  const values = { ...shared, ...themes[name] };
  const read = token => colour(resolve(token, values));

  for (const { bg, fg, kind } of PAIRS) {
    const layers = [bg].flat();
    const key = `${name} ${fg} on ${layers.join(' + ')}`;

    try {
      // Whatever is translucent sits on what is under it: the page on white (a browser's
      // canvas), the ground on the page (each layer of a stacked ground on the one below), the
      // word or the line on the ground.
      const page = over(read('--background-01'), [255, 255, 255, 1]);
      const ground = layers.reduce((under, layer) => over(read(layer), under), page);
      const measured = ratio(over(read(fg), ground), ground);
      const floor = FLOORS[kind];
      const known = KNOWN_TODAY[key];
      let verdict = measured >= floor ? 'ok' : 'FAIL';

      if (known) verdict = measured >= floor ? 'STALE' : measured >= known.ratio - 0.005 ? 'known' : 'WORSE';

      rows.push({ floor, key, kind, measured, verdict });
    } catch (error) {
      problems.push(`${key}: ${error.message}`);
    }
  }
}

for (const key of Object.keys(KNOWN_TODAY)) {
  if (!rows.some(row => row.key === key)) problems.push(`KNOWN_TODAY names a pair nobody measures: ${key}`);
}

const width = Math.max(0, ...rows.map(row => row.key.length));
const notes = {
  FAIL: () => 'under its floor',
  known: row => `known today (${KNOWN_TODAY[row.key].ratio}:1) — ${KNOWN_TODAY[row.key].why}`,
  ok: () => '',
  STALE: () => 'passes now: remove it from KNOWN_TODAY',
  WORSE: row => `worse than the ${KNOWN_TODAY[row.key].ratio}:1 it was allowed`
};

for (const row of rows) {
  const note = notes[row.verdict](row);

  console.log(`[contrast] ${row.verdict.padEnd(5)} ${row.key.padEnd(width)} ${row.measured.toFixed(2).padStart(6)}:1  ${row.kind} ≥ ${row.floor}${note ? `  ${note}` : ''}`);
}

for (const problem of problems) console.log(`[contrast] PROBLEM ${problem}`);

const failed = rows.filter(row => ['FAIL', 'STALE', 'WORSE'].includes(row.verdict));
const count = verdict => rows.filter(row => row.verdict === verdict).length;

console.log(
  `[contrast] ${names.length} themes × ${PAIRS.length} pairs: ${count('ok')} pass, ${count('known')} known from today, ${failed.length} fail, ${problems.length} problems`
);

process.exit(failed.length + problems.length === 0 ? 0 : 1);
