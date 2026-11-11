import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * No component names a colour (`0106`, PRD 4 of project 024).
 *
 * Every colour a module stylesheet paints comes from a semantic token, and the tokens get
 * their values from the theme in `styles/themes.css`. A raw colour, a palette step or a
 * theme's name in a component is a colour that does not change with the theme — or, worse,
 * one that only some themes change — so this fails on any of them, in `apps/web` and in
 * `packages/ui`.
 *
 * Allowed: `transparent`, `currentColor`, `inherit` and the other keywords; the system colours
 * a `forced-colors` block uses (`Canvas`, `Highlight`…); and `color-mix()` when every colour
 * it mixes is a token or `transparent`.
 */

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const TREES = ['apps/web/src', 'packages/ui/src'];

const THEME_NAMES = ['claro', 'oscuro', 'huerta', 'pulso', 'contraste'];
const RULES: [string, RegExp][] = [
  ['a hex colour', /#[0-9a-f]{3,8}\b/i],
  ['a colour function', /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|light-dark)\(/i],
  ['a named colour', /(?:^|[\s,(])(?:white|black)(?=$|[\s,);!])/i],
  ['a palette step', /--color-(?:gray|blue|green|red|amber)-/],
  ['a palette constant', /--color-(?:white|black)\b/]
];

/** What a stylesheet says, without its comments and without what a `url()` points at. */
function strip(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\((?:[^()'"]|'[^']*'|"[^"]*")*\)/g, 'url()');
}

/** Each declaration's value. A selector or an at-rule's condition never ends in `;` or `}`. */
function values(css: string) {
  return [...css.matchAll(/:\s*([^;{}]+)(?=[;}])/g)].map(match => match[1].trim());
}

/** Each selector: what comes before a `{`. */
function selectors(css: string) {
  return [...css.matchAll(/([^{};]+)\{/g)].map(match => match[1].trim());
}

/** The colours one `color-mix()` mixes, without their percentages. */
function mixed(value: string) {
  const found: string[] = [];

  for (let start = value.indexOf('color-mix('); start !== -1; start = value.indexOf('color-mix(', start + 1)) {
    let depth = 0;
    let end = start + 'color-mix'.length;

    for (; end < value.length; end++) {
      if (value[end] === '(') {
        depth++;
      }

      if (value[end] === ')' && --depth === 0) {
        break;
      }
    }

    const [, ...colours] = splitArgs(value.slice(start + 'color-mix('.length, end));

    found.push(...colours.map(colour => colour.replace(/\s+[\d.]+%$/, '').replace(/^[\d.]+%\s+/, '')));
  }

  return found;
}

function splitArgs(text: string) {
  const parts = [''];
  let depth = 0;

  for (const char of text) {
    if (char === '(') {
      depth++;
    }

    if (char === ')') {
      depth--;
    }

    if (char === ',' && depth === 0) {
      parts.push('');
    } else {
      parts[parts.length - 1] += char;
    }
  }

  return parts.map(part => part.trim());
}

/** What a stylesheet does wrong, one line per finding. */
function findings(css: string) {
  const text = strip(css);
  const found: string[] = [];

  for (const value of values(text)) {
    // A `color-mix()` of tokens is allowed, so its own name is not a finding; what it mixes is.
    const plain = value.replace(/color-mix\(/g, 'mix(');

    for (const [what, pattern] of RULES) {
      if (pattern.test(plain)) {
        found.push(`${what}: ${value}`);
      }
    }

    for (const colour of mixed(value)) {
      if (!/^var\(--[\w-]+\)$/.test(colour) && !/^(?:transparent|currentcolor)$/i.test(colour)) {
        found.push(`color-mix() of something that is not a token: ${value}`);
      }
    }
  }

  for (const selector of selectors(text)) {
    if (/data-theme/.test(selector) || THEME_NAMES.some(name => new RegExp(`\\b${name}\\b`, 'i').test(selector))) {
      found.push(`a theme named in a selector: ${selector}`);
    }
  }

  // The scheme is the theme's to decide: a module that asks the device paints the device's
  // scheme under a theme that chose the other one.
  if (/prefers-color-scheme/.test(text)) {
    found.push('a prefers-color-scheme query');
  }

  return found;
}

function moduleStylesheets(tree: string): string[] {
  return readdirSync(join(root, tree), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.module.css'))
    .map(entry => join(entry.parentPath, entry.name));
}

describe('the colour rule finds what it is for', () => {
  it.each([
    ['.a { color: #fff; }', 'a hex colour'],
    ['.a { background: rgb(0 0 0 / 40%); }', 'a colour function'],
    ['.a { fill: hsl(0, 0%, 100%); }', 'a colour function'],
    ['.a { color: oklch(70% 0.1 120); }', 'a colour function'],
    ['.a { color: light-dark(#fff, #000); }', 'a hex colour'],
    ['.a { border: 1px solid black; }', 'a named colour'],
    ['.a { color: white }', 'a named colour'],
    ['.a { color: var(--color-gray-11); }', 'a palette step'],
    ['.a { fill: var(--color-white); }', 'a palette constant'],
    ['.a { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand-fill) 18%, #fff); }', 'color-mix() of something that is not a token'],
    ["[data-theme='oscuro'] .a { color: var(--foreground-01); }", 'a theme named in a selector'],
    ['.pulso { color: var(--foreground-01); }', 'a theme named in a selector'],
    ['@media (prefers-color-scheme: dark) { .a { color: var(--foreground-01); } }', 'a prefers-color-scheme query']
  ])('%s → %s', (css, what) => {
    expect(findings(css).some(finding => finding.startsWith(what))).toBe(true);
  });

  it.each([
    '.a { color: var(--foreground-01); background: transparent; border-color: currentColor; }',
    '.a { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand-fill) 18%, transparent); }',
    '.a { background: color-mix(in srgb, var(--color-brand-fill) 40%, var(--surface-card)); }',
    '.a { white-space: nowrap; color: inherit; }',
    '@media (forced-colors: active) { .a { border: 1px solid Highlight; color: CanvasText; } }',
    '/* a white plate on #fff */ .a { color: var(--foreground-02); }',
    '.a { background-image: url("data:image/svg+xml,%3Csvg fill=\'white\'%3E"); }',
    '#main:focus-visible { outline-color: var(--focus-ring-color); }',
    '.a:hover, .b:not(.c) { color: var(--color-brand-11); }'
  ])('lets %s through', css => {
    expect(findings(css)).toEqual([]);
  });
});

describe('every module stylesheet reads its colours from a token', () => {
  const files = TREES.flatMap(moduleStylesheets);

  it('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('names no raw colour, no palette step and no theme', () => {
    const report = files.flatMap(file => findings(readFileSync(file, 'utf8')).map(finding => `${relative(root, file)} — ${finding}`));

    expect(report).toEqual([]);
  });
});
