import type { ThemeColors } from 'ui/utils/theme';

/**
 * The colours NutrIA paints where a stylesheet cannot reach: the favicon and home-screen icon,
 * the web manifest, the browser's chrome (`theme-color`) and the picture a shared link shows.
 * One module, so they are one palette — the palette of `styles/themes.css` (`0107`). A test
 * (`brandColours.test.ts`) holds each theme's page colour here to that theme's
 * `--background-01` there.
 *
 * Fixed values, not tokens: an icon is drawn once and lives on a home screen, and a shared
 * link's picture is drawn on a server that never learns which theme anybody chose.
 */

/** Each theme's page colour, for the browser's chrome when a person chooses that theme. */
export const THEME_PAGE_COLOURS: ThemeColors = { claro: '#fbf5ea', contraste: '#ffffff', huerta: '#f1f8ef', oscuro: '#2a1b26', pulso: '#140b2d' };

/** Automático's chrome: Claro's page on a light device, Oscuro's on a dark one. */
export const AUTO_PAGE_COLOURS = { dark: THEME_PAGE_COLOURS.oscuro, light: THEME_PAGE_COLOURS.claro } as const;

/** The accent's two ends — tomato to saffron — that the leaf is drawn in. */
export const ACCENT_START = '#e2512b';
export const ACCENT_END = '#f0a22c';

/** Oscuro's aubergine: the tile under the home-screen icon and the shared link's ground. */
export const TILE_BACKGROUND = THEME_PAGE_COLOURS.oscuro;

/** Oscuro's ink and its soft text, for words on that ground. */
export const TILE_INK = '#fbefe3';
export const TILE_SOFT = '#c9aeb9';
