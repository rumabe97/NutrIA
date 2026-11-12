import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The mails' colours are literals — a mail cannot read the web's tokens — and each copies a
 * token of the web's themes (project 024, phase 7b). This holds them together.
 *
 * How it finds them: it reads `Layout.ts` as text and takes, inside `const CLARO = { … }` and
 * `const OSCURO = { … }`, every line written `key: '#rrggbb', // --token`. It reads
 * `apps/web/src/styles/themes.css` as text, takes the block that begins `[data-theme='claro'] {`
 * (or `'oscuro'`) up to its closing brace, and finds `--token: #rrggbb;` in it. A literal that
 * differs from its token, a token the theme no longer has, or a line with a colour and no token
 * fails here. Then it reads every template beside `Layout.ts` and fails on any colour written
 * outside those two tables, so a template cannot paint a colour of its own.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUT = readFileSync(join(HERE, 'Layout.ts'), 'utf8');
const THEMES = readFileSync(join(HERE, '../../../../../web/src/styles/themes.css'), 'utf8');

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function table(name: 'CLARO' | 'OSCURO'): { readonly lines: readonly string[]; readonly pairs: readonly (readonly [string, string, string])[] } {
  const body = new RegExp(`const ${name} = \\{([^}]*)\\} as const;`).exec(LAYOUT)?.[1] ?? '';
  const lines = body.split('\n').filter(line => line.trim() !== '');
  const pairs = lines.flatMap(line => {
    const match = /^\s*(\w+): '(#[0-9a-f]{6})',? \/\/ (--[\w-]+)\s*$/.exec(line);

    return match ? [[match[1] ?? '', match[2] ?? '', match[3] ?? ''] as const] : [];
  });

  return { lines, pairs };
}

function tokenOf(theme: 'claro' | 'oscuro', token: string): string | undefined {
  const block = new RegExp(`\\[data-theme='${theme}'\\] \\{([^}]*)\\}`).exec(THEMES)?.[1] ?? '';

  return new RegExp(`\\s${token}: (#[0-9a-f]{6});`).exec(block)?.[1];
}

describe.each([
  ['CLARO', 'claro'],
  ['OSCURO', 'oscuro']
] as const)('the mail’s %s colours', (name, theme) => {
  const { lines, pairs } = table(name);

  it('are each written beside the token they copy', () => {
    expect(lines.length).toBeGreaterThan(0);
    expect(pairs).toHaveLength(lines.length);
  });

  it.each(pairs)(`%s (%s) is ${theme}'s %s`, (_key, literal, token) => {
    expect(tokenOf(theme, token)).toBe(literal);
  });
});

describe('the two tables', () => {
  it('name the same colours, so the dark block repaints everything the light one paints', () => {
    expect(table('OSCURO').pairs.map(([key, , token]) => [key, token])).toEqual(table('CLARO').pairs.map(([key, , token]) => [key, token]));
  });
});

describe('a colour in a template', () => {
  const tableLines = new Set([...table('CLARO').lines, ...table('OSCURO').lines]);
  const templates = readdirSync(HERE).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

  it.each(templates)('%s writes no colour outside the two tables', file => {
    const stray = readFileSync(join(HERE, file), 'utf8')
      .split('\n')
      .filter(line => !tableLines.has(line))
      // A comment may name a colour; code may not.
      .filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .filter(line => HEX.test(line.replace(/&#\d+;/g, '')));

    expect(stray).toEqual([]);
  });
});
