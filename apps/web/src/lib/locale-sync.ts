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
 * Reconciles the browser's language with the account's, at sign-in.
 *
 * The direction depends on who chose. A cookie already present means someone
 * picked a language *in this browser* — most likely on the landing page, before
 * they had an account to store it on — and that choice should win and be kept.
 * No cookie means nothing was chosen here, so the account's stored preference is
 * the better answer.
 *
 * Getting this backwards is what made "the interface is English and the data is
 * Spanish" possible: a pull-only sync overwrote a deliberate choice with a stale
 * profile, or left the profile stale while the cookie moved on.
 *
 * Failure is deliberately silent. The worst outcome is a session in the
 * negotiated language, which is a mild annoyance; blocking a successful sign-in
 * on it would be a much worse one.
 */
export async function syncLocaleFromProfile(): Promise<void> {
  try {
    const chosen = readLocaleCookie();

    if (chosen) {
      await api('/profile', { body: { locale: chosen }, method: 'PATCH' });

      return;
    }

    const profile = await api<FullProfileView>('/profile');
    const stored = parseLocale(profile.profile?.locale);

    if (stored) {writeLocaleCookie(stored);}
  } catch {
    // Keep whatever language this session already has.
  }
}

/** The locale this browser has chosen, if any. */
function readLocaleCookie(): Locale | null {
  const match = document.cookie.split('; ').find(entry => entry.startsWith(`${LOCALE_COOKIE}=`));

  return parseLocale(match?.slice(LOCALE_COOKIE.length + 1));
}
