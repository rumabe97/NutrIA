import { describe, expect, it } from 'vitest';

import { INGREDIENT_SEED } from '.';
import { SEASON_ROWS, seasonMonthsFor } from './seasons';

const BY_SLUG = new Map(INGREDIENT_SEED.map(entry => [entry.slug, entry]));

describe('seasons overlay', () => {
  it('names only rows the catalogue has', () => {
    expect(SEASON_ROWS.map(([slug]) => slug).filter(slug => !BY_SLUG.has(slug))).toEqual([]);
  });

  it('names only fresh produce', () => {
    expect(SEASON_ROWS.map(([slug]) => slug).filter(slug => BY_SLUG.get(slug)?.category !== 'produce')).toEqual([]);
  });

  it('names each row once', () => {
    const seen = new Set<string>();
    const twice = SEASON_ROWS.map(([slug]) => slug).filter(slug => (seen.has(slug) ? true : (seen.add(slug), false)));

    expect(twice).toEqual([]);
  });

  it('uses months 1 to 12, ascending, each once', () => {
    for (const [slug, months] of SEASON_ROWS) {
      expect(
        months.every(month => Number.isInteger(month) && month >= 1 && month <= 12),
        slug
      ).toBe(true);
      expect(
        [...months].sort((a, b) => a - b),
        slug
      ).toEqual(months);
      expect(new Set(months).size, slug).toBe(months.length);
    }
  });

  // Empty means every month — the default; all twelve says the same in more words.
  it('never gives a row an empty list or every month', () => {
    for (const [slug, months] of SEASON_ROWS) {
      expect(months.length, slug).toBeGreaterThan(0);
      expect(months.length, slug).toBeLessThan(12);
    }
  });

  it('leaves what is sold all year to every month', () => {
    for (const slug of ['cebolla', 'ajo', 'patata', 'zanahoria', 'limon', 'platano']) {
      expect(seasonMonthsFor({ slug } as never), slug).toEqual([]);
    }
  });
});
