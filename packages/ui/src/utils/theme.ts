import { schemeOf, storedTheme, THEME_STORAGE_KEY } from './themeScript';

import type { Theme, ThemeChoice } from './themeScript';

/**
 * Choosing a theme on this device (`0106`), after the first paint — the half the inline
 * script in `themeScript` does not do.
 *
 * What it may touch is the `legal` agent's list (`docs/legal/2026-11-11-redesign.md` § 1.7):
 * `localStorage` under its one key, written only when a person chooses and removed when they
 * choose Automático; `<html>`'s `data-theme` and `color-scheme`; and the `theme-color` meta
 * elements. Nothing here sends the value anywhere — no cookie, no header, no request — and it
 * is read for nothing but painting.
 */

/** Every choice, in the order a menu lists them. */
export const THEME_CHOICES = ['auto', 'claro', 'oscuro', 'huerta', 'pulso', 'contraste'] as const satisfies readonly ThemeChoice[];

/** The colour the browser's own chrome takes under each theme: the theme's page colour. */
export type ThemeColors = Readonly<Record<Theme, string>>;

/** Fired on `window` when this page changes the theme, so every control showing it agrees. */
const CHANGE_EVENT = 'nutria-theme-change';

/** Where the `theme-color` meta's own value (Automático's, per scheme) is kept while a theme overrides it. */
const AUTO_COLOR = 'data-auto-content';

/** A choice made on this page while storage refused it: it lasts for the visit, and no longer. */
let unstored: ThemeChoice | null = null;

/** The choice in force on this device. A store that cannot be read means Automático. */
export function readTheme(): ThemeChoice {
  return unstored ?? storedTheme(() => window.localStorage.getItem(THEME_STORAGE_KEY))?.theme ?? 'auto';
}

/** Paints a choice: the attribute and the scheme on `<html>`, or neither for Automático. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;

  if (choice === 'auto') {
    root.removeAttribute('data-theme');
    root.style.removeProperty('color-scheme');
  } else {
    root.setAttribute('data-theme', choice);
    root.style.colorScheme = schemeOf(choice);
  }
}

/**
 * Gives the browser's chrome the theme's colour. Automático hands back what the page was
 * served with — one meta per scheme, each with its media query — which is kept on the element
 * the first time a theme replaces it.
 */
export function applyThemeColor(choice: ThemeChoice, colors: ThemeColors | undefined) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (!meta.hasAttribute(AUTO_COLOR)) {
      meta.setAttribute(AUTO_COLOR, meta.content);
    }

    meta.content = choice === 'auto' || !colors ? (meta.getAttribute(AUTO_COLOR) ?? meta.content) : colors[choice];
  }
}

/**
 * A person's choice: kept on the device (Automático keeps nothing), painted, and announced to
 * the other controls on this page. Other tabs hear of it through the `storage` event.
 */
export function chooseTheme(choice: ThemeChoice) {
  try {
    if (choice === 'auto') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    }

    unstored = null;
  } catch {
    // Storage blocked (Safari's private mode, a policy): the page still changes, for this visit.
    unstored = choice;
  }

  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Calls `onChange` whenever the choice changes — here, or in another tab of this site, which
 * also repaints this one. Returns the unsubscribe, as `useSyncExternalStore` expects.
 */
export function subscribeTheme(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    // `key` is null when the whole store was cleared.
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(readTheme());
      onChange();
    }
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
