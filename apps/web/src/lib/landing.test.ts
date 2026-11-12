import { describe, expect, it } from 'vitest';
import { enGB } from 'i18n/dictionaries/en-GB';
import { esES } from 'i18n/dictionaries/es-ES';

import { LANDING_PICTURES, LANDING_PICTURES_MAX } from './landingPictures';
import { titleAccent } from './titleAccent';

describe('titleAccent', () => {
  it('splits a title around its own last words', () => {
    expect(titleAccent('Nutrición que se adapta a ti.', 'a ti.')).toEqual({ accent: 'a ti.', lead: 'Nutrición que se adapta ' });
  });

  it('draws the whole title plain when the accent is not its end', () => {
    expect(titleAccent('Nutrición que se adapta a ti.', 'a vosotros.')).toEqual({ accent: '', lead: 'Nutrición que se adapta a ti.' });
    expect(titleAccent('Nutrición', '')).toEqual({ accent: '', lead: 'Nutrición' });
    expect(titleAccent('a ti.', 'a ti.')).toEqual({ accent: '', lead: 'a ti.' });
  });
});

describe.each([
  ['es-ES', esES],
  ['en-GB', enGB]
])('the landing page in %s', (_, dictionary) => {
  it('accents words its title really ends with, so the heading reads as it always did', () => {
    const { accent, lead } = titleAccent(dictionary.landing.title, dictionary.landing.titleAccent);

    expect(accent).toBe(dictionary.landing.titleAccent);
    expect(`${lead}${accent}`).toBe(dictionary.landing.title);
  });

  it('never calls a generated picture a photograph (docs/legal/2026-11-11-redesign.md § 2.8 W2)', () => {
    expect(JSON.stringify(dictionary.landing)).not.toMatch(/\bfoto|fotograf|\bphoto/i);
  });
});

describe('the landing pictures', () => {
  it('are at most three, each an untouched absolute address with its recipe recorded', () => {
    expect(LANDING_PICTURES.length).toBeLessThanOrEqual(LANDING_PICTURES_MAX);

    for (const picture of LANDING_PICTURES) {
      expect(picture.path).toMatch(/^https:\/\//);
      expect(picture.recipeId).not.toBe('');
    }
  });
});
