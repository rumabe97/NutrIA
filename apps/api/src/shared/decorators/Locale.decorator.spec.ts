import { describe, expect, it } from '@jest/globals';

import { localeFromHeader } from './Locale.decorator.js';

/**
 * The parsing, tested directly.
 *
 * `createParamDecorator` hides its factory in Nest's metadata, so the decorator
 * itself is deliberately three lines of plumbing over this function — the rule is
 * what is worth testing, and a rule reachable only through a framework's
 * reflection is a rule nobody tests.
 */
describe('localeFromHeader', () => {
  it('accepts a locale the API can resolve content into', () => {
    expect(localeFromHeader('en-GB')).toBe('en-GB');
    expect(localeFromHeader('es-ES')).toBe('es-ES');
  });

  it('takes the first tag, which is the exact one the web client sends', () => {
    expect(localeFromHeader('es-ES,es;q=0.9,en;q=0.8')).toBe('es-ES');
  });

  it('returns null for a locale we do not ship, so the stored preference decides', () => {
    expect(localeFromHeader('fr-FR')).toBeNull();
    // en-US is deliberately not matched to en-GB here: this header is the web
    // app's own deliberate signal, and a browser's regional default is not one.
    expect(localeFromHeader('en-US')).toBeNull();
  });

  it('returns null when the header is absent or repeated', () => {
    expect(localeFromHeader(undefined)).toBeNull();
    expect(localeFromHeader(['en-GB', 'es-ES'])).toBeNull();
  });
});
