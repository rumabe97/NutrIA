import { api } from './api';
import { LOCALE_COOKIE, parseLocale } from '../i18n/config';

import type { FullProfileView } from 'core/controllers/Profile';
import type { Locale } from '../i18n/config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Writes the presentation locale cookie.
 *
 * Here rather than inline in the switcher so there is one definition of the
 * cookie's name, lifetime and flags — and so the two places that set it cannot
 * disagree about any of the three.
 */
export function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/**
 * Copies the profile's stored locale into the presentation cookie.
 *
 * Called once, after sign-in. Failure is deliberately silent: the worst outcome
 * is that this session stays in the negotiated language, which is a mild
 * annoyance, and blocking a successful sign-in on it would be a much worse one.
 */
export async function syncLocaleFromProfile(): Promise<void> {
  try {
    const profile = await api<FullProfileView>('/profile');
    const locale = parseLocale(profile.profile?.locale);

    if (locale) {writeLocaleCookie(locale);}
  } catch {
    // Keep the negotiated locale.
  }
}
