import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { AUTO_PAGE_COLOURS, THEME_PAGE_COLOURS, TILE_INK, TILE_SOFT } from './brandColours';

/** Each theme block's `--background-01` (and two of Oscuro's text colours), read from the stylesheet. */
const css = readFileSync(new URL('../styles/themes.css', import.meta.url), 'utf8');

function tokenOf(theme: string, token: string) {
  const block = css.match(new RegExp(`\\[data-theme='${theme}'\\] \\{([^}]*)\\}`))?.[1] ?? '';

  return block.match(new RegExp(`${token}: (#[0-9a-f]{6});`))?.[1];
}

describe('brand colours', () => {
  it.each(Object.entries(THEME_PAGE_COLOURS))("%s's chrome is that theme's page colour", (theme, colour) => {
    expect(tokenOf(theme, '--background-01')).toBe(colour);
  });

  it("Automático's chrome is Claro's and Oscuro's", () => {
    expect(AUTO_PAGE_COLOURS).toEqual({ dark: THEME_PAGE_COLOURS.oscuro, light: THEME_PAGE_COLOURS.claro });
  });

  it("the shared picture's words are Oscuro's", () => {
    expect(tokenOf('oscuro', '--foreground-01')).toBe(TILE_INK);
    expect(tokenOf('oscuro', '--foreground-02')).toBe(TILE_SOFT);
  });
});
