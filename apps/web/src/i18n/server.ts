import { cookies, headers } from 'next/headers';

import { DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale, parseLocale } from './config';
import { enGB } from './dictionaries/en-GB';
import { esES } from './dictionaries/es-ES';

import type { Dictionary } from './dictionaries/es-ES';
import type { Locale } from './config';

const DICTIONARIES: Record<Locale, Dictionary> = { 'en-GB': enGB, 'es-ES': esES };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * The locale this render should use.
 *
 * Cookie first, because it is the one place a deliberate choice is recorded;
 * `Accept-Language` second, so a first-time visitor gets their own language
 * without anyone having chosen anything; the default last. Reading the header
 * here rather than in middleware means the very first request is already in the
 * right language — a redirect or a flash of Spanish to set a cookie would be a
 * worse first impression than any of this is worth.
 */
export async function activeLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const chosen = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  if (chosen) {
    return chosen;
  }

  return negotiateLocale(headerStore.get('accept-language')) ?? DEFAULT_LOCALE;
}

/** The dictionary for this render. Server components import this directly. */
export async function getDictionary(): Promise<Dictionary> {
  return dictionaryFor(await activeLocale());
}
