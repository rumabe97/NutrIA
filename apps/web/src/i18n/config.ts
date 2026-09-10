/**
 * Locale identity and negotiation. Pure, and safe on both sides of the RSC
 * boundary — the server bits live in `./server`, which client code cannot import.
 */

export const LOCALES = ['es-ES', 'en-GB'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Spanish first, by product decision rather than by accident. Nothing assumes
 * exactly two locales: adding one means a dictionary file and an entry here.
 */
export const DEFAULT_LOCALE: Locale = 'es-ES';

/**
 * Where the *presentation* locale lives.
 *
 * The durable preference is `profiles.locale` in the database; this cookie is
 * how it reaches a render without a round trip per page, and how a signed-out
 * visitor gets a language at all. When they disagree the database wins on the
 * next sign-in or profile load — a cookie is a cache, not a source of truth.
 */
export const LOCALE_COOKIE = 'nutria_locale';

/**
 * How long that cookie lives. A year: a language preference does not go stale,
 * and asking again every session would be asking for nothing.
 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}

export function parseLocale(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null;
}

/**
 * Picks a locale from an `Accept-Language` header.
 *
 * Matches the language subtag rather than the full tag, so `en`, `en-US` and
 * `en-GB` all reach the English dictionary. A visitor whose browser says `en-US`
 * getting Spanish because we only ship `en-GB` would be a silly way to lose them.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const ranked = acceptLanguage
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params.find(param => param.trim().startsWith('q='))?.split('=')[1];

      return { quality: quality === undefined ? 1 : Number(quality), tag: (tag ?? '').trim().toLowerCase() };
    })
    .filter(entry => entry.tag !== '' && !Number.isNaN(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const language = tag.split('-')[0];
    const match = LOCALES.find(locale => locale.toLowerCase() === tag || locale.split('-')[0] === language);

    if (match) {
      return match;
    }
  }

  return DEFAULT_LOCALE;
}
