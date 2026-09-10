import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, isLocale, LOCALES, negotiateLocale, parseLocale } from './config';
import { enGB } from './dictionaries/en-GB';
import { esES } from './dictionaries/es-ES';
import { interpolate } from './interpolate';
import { isLocalised, localeFromPathname, LOCALISED_PATHS, withLocale, withoutLocale } from './routes';

describe('negotiateLocale', () => {
  it('falls back to the default when the header is absent', () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('matches an exact tag', () => {
    expect(negotiateLocale('en-GB')).toBe('en-GB');
  });

  it('matches on the language subtag, so en-US does not get Spanish', () => {
    // We ship en-GB and not en-US. Sending an American visitor to the Spanish
    // interface because of a region suffix would be a silly way to lose them.
    expect(negotiateLocale('en-US,en;q=0.9')).toBe('en-GB');
  });

  it('respects the quality ordering rather than the written order', () => {
    expect(negotiateLocale('fr;q=0.9,en;q=1.0')).toBe('en-GB');
    expect(negotiateLocale('en;q=0.2,es;q=0.8')).toBe('es-ES');
  });

  it('ignores languages it does not have', () => {
    expect(negotiateLocale('de-DE,fr-FR')).toBe(DEFAULT_LOCALE);
  });

  it('survives a malformed header instead of throwing on it', () => {
    expect(negotiateLocale(';;;q=')).toBe(DEFAULT_LOCALE);
  });
});

describe('parseLocale', () => {
  it('accepts only locales we ship', () => {
    expect(parseLocale('es-ES')).toBe('es-ES');
    expect(parseLocale('en-US')).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
    expect(isLocale('nonsense')).toBe(false);
  });
});

describe('the locale in the URL', () => {
  it('reads English from the prefix and everything else as the default', () => {
    expect(localeFromPathname('/en')).toBe('en-GB');
    expect(localeFromPathname('/en/registro')).toBe('en-GB');
    expect(localeFromPathname('/registro')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('/')).toBe(DEFAULT_LOCALE);
  });

  it('matches whole segments, so a Spanish route starting with "en" is not English', () => {
    // `/entrenamiento` would be a Spanish page, not the English tree.
    expect(localeFromPathname('/entrenamiento')).toBe(DEFAULT_LOCALE);
    expect(withoutLocale('/entrenamiento')).toBe('/entrenamiento');
  });

  it('strips the prefix back to the shared path', () => {
    expect(withoutLocale('/en')).toBe('/');
    expect(withoutLocale('/en/')).toBe('/');
    expect(withoutLocale('/en/acceder')).toBe('/acceder');
    expect(withoutLocale('/acceder')).toBe('/acceder');
  });

  it('builds the same page in the other language', () => {
    expect(withLocale('/', 'en-GB')).toBe('/en');
    expect(withLocale('/acceder', 'en-GB')).toBe('/en/acceder');
    expect(withLocale('/acceder', 'es-ES')).toBe('/acceder');
    expect(withLocale('/', 'es-ES')).toBe('/');
  });

  it('round-trips every localised path in both languages', () => {
    for (const path of LOCALISED_PATHS) {
      for (const locale of LOCALES) {
        expect(withoutLocale(withLocale(path, locale))).toBe(path);
        expect(localeFromPathname(withLocale(path, locale))).toBe(locale);
      }
    }
  });

  it('knows which pages have a twin, so the signed-in screens keep their Spanish URLs', () => {
    expect(isLocalised('/registro')).toBe(true);
    expect(isLocalised('/en/registro')).toBe(true);
    expect(isLocalised('/inicio')).toBe(false);
    expect(isLocalised('/plan/historial')).toBe(false);
  });
});

describe('interpolate', () => {
  it('fills a placeholder', () => {
    expect(interpolate('Step {current} of {total}', { current: 2, total: 9 })).toBe('Step 2 of 9');
  });

  it('leaves an unknown placeholder visible rather than printing "undefined"', () => {
    // A visible {count} is a bug report. The word "undefined" is a mystery.
    expect(interpolate('At least {count} characters.', {})).toBe('At least {count} characters.');
  });
});

/**
 * The type system already guarantees both dictionaries have the same keys.
 * What it cannot check is that a translation kept the *placeholders*, and a
 * dropped `{count}` silently loses a number from a sentence that still reads
 * fine.
 */
describe('the dictionaries agree on more than their keys', () => {
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

  function walk(spanish: unknown, english: unknown, path: string, visit: (a: string, b: string, path: string) => void): void {
    if (typeof spanish === 'string' && typeof english === 'string') {
      visit(spanish, english, path);

      return;
    }

    if (Array.isArray(spanish) && Array.isArray(english)) {
      spanish.forEach((item, index) => walk(item, english[index], `${path}[${index}]`, visit));

      return;
    }

    if (typeof spanish === 'object' && spanish !== null && typeof english === 'object' && english !== null) {
      for (const key of Object.keys(spanish)) {
        walk((spanish as Record<string, unknown>)[key], (english as Record<string, unknown>)[key], `${path}.${key}`, visit);
      }
    }
  }

  it('ships every locale in LOCALES', () => {
    expect([...LOCALES].sort()).toEqual(['en-GB', 'es-ES']);
  });

  it('keeps the same placeholders in every string', () => {
    const mismatched: string[] = [];

    walk(esES, enGB, 'root', (spanish, english, path) => {
      if (placeholders(spanish).join(',') !== placeholders(english).join(',')) {mismatched.push(path);}
    });

    expect(mismatched).toEqual([]);
  });

  it('has no empty string anywhere', () => {
    const empty: string[] = [];

    walk(esES, enGB, 'root', (spanish, english, path) => {
      if (spanish.trim() === '' || english.trim() === '') {empty.push(path);}
    });

    expect(empty).toEqual([]);
  });

  it('keeps list-shaped entries the same length, so a screen cannot lose a card', () => {
    expect(enGB.landing.faq).toHaveLength(esES.landing.faq.length);
    expect(enGB.landing.features).toHaveLength(esES.landing.features.length);
    expect(enGB.landing.steps).toHaveLength(esES.landing.steps.length);
    expect(enGB.landing.safety).toHaveLength(esES.landing.safety.length);
    expect(enGB.landing.preview.meals).toHaveLength(esES.landing.preview.meals.length);
  });
});
