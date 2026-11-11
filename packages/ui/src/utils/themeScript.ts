/**
 * The theme a person chose on this device, applied before the first paint (`0106`).
 *
 * A theme is a block of token values selected by `data-theme` on `<html>`; the app's
 * stylesheet holds the blocks. No attribute is Automático: the device's scheme picks the
 * block, so a page whose script did not run — JavaScript off, a crawler, `apps/docs` —
 * is still legible.
 *
 * The choice is one short string in `localStorage`, under `THEME_STORAGE_KEY`. It never
 * leaves the device: no cookie, no header, no account field. It is a preference of the
 * device, not of a session, so signing out does not forget it.
 */

/** Where the choice is kept, in `localStorage`. */
export const THEME_STORAGE_KEY = 'nutria-theme';

/**
 * Every theme a person can choose, with the scheme the browser paints its own surfaces in
 * (form controls, scrollbars) under it. Automático is the absence of a choice, not an entry.
 */
const THEMES = { claro: 'light', contraste: 'light', huerta: 'light', oscuro: 'dark', pulso: 'dark' } as const;

/** One of the five themes a person can choose. */
export type Theme = keyof typeof THEMES;

/** What a person can choose: a theme, or Automático — which is no stored value at all. */
export type ThemeChoice = 'auto' | Theme;

/** The scheme the browser paints its own surfaces in under a theme. */
export function schemeOf(theme: Theme): (typeof THEMES)[Theme] {
  return THEMES[theme];
}

interface StoredTheme {
  colorScheme: (typeof THEMES)[Theme];
  theme: Theme;
}

/**
 * What a stored value means: one of the five themes and its scheme, or nothing — an
 * unknown value, an empty store and a store that throws (Safari with storage blocked
 * throws on the read) all mean Automático.
 *
 * `ui/utils/theme` reads the device with it after the first paint; its test holds
 * `THEME_SCRIPT` to the same answers.
 */
export function storedTheme(read: () => string | null): StoredTheme | null {
  try {
    const value = read();

    return value !== null && Object.hasOwn(THEMES, value) ? { colorScheme: THEMES[value as Theme], theme: value as Theme } : null;
  } catch {
    return null;
  }
}

/**
 * The same logic as `storedTheme`, as the static script `RootShell` puts in `<head>`. It
 * is built once from the same key and the same list, so it is the same bytes on every
 * page and every public page stays prerendered. Plain ES5, because it runs before
 * anything else on the page and on whatever browser opened it.
 *
 * It only ever sets: with no valid choice it leaves `<html>` untouched, which is
 * Automático.
 */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),s=${JSON.stringify(THEMES)};` +
  "if(t!==null&&Object.prototype.hasOwnProperty.call(s,t)){var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=s[t]}}catch(e){}";
