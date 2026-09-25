import { describe, expect, it } from 'vitest';

import { mealSlot } from '../../schemas/_enums';

import { INGREDIENT_SEED } from '.';
import { MEAL_ROWS, mealSlotsFor } from './meals';

const SLUGS = new Set(INGREDIENT_SEED.map(entry => entry.slug));
const SLOTS = new Set<string>(mealSlot.enumValues);

describe('meals overlay', () => {
  it('names only rows the catalogue has', () => {
    expect(MEAL_ROWS.map(([slug]) => slug).filter(slug => !SLUGS.has(slug))).toEqual([]);
  });

  it('names each row once', () => {
    const seen = new Set<string>();
    const twice = MEAL_ROWS.map(([slug]) => slug).filter(slug => (seen.has(slug) ? true : (seen.add(slug), false)));

    expect(twice).toEqual([]);
  });

  // `none` is the one other word, and only alone: a row in no meal at all.
  it('uses only meal_slot values, each once per row, or none alone', () => {
    for (const [slug, slots] of MEAL_ROWS) {
      if (slots.includes('none')) {
        expect(slots, slug).toEqual(['none']);
        continue;
      }

      expect(
        slots.filter(slot => !SLOTS.has(slot)),
        slug
      ).toEqual([]);
      expect(new Set(slots).size, slug).toBe(slots.length);
    }
  });

  // An empty list means every meal — the default, which absence already says.
  // A list naming all six says the same thing in more words.
  it('never gives a row an empty list or every meal', () => {
    for (const [slug, slots] of MEAL_ROWS) {
      expect(slots.length, slug).toBeGreaterThan(0);
      expect(slots.length, slug).toBeLessThan(SLOTS.size);
    }
  });

  // Supper is a late snack and takes the snacks' foods (PRD § Open questions),
  // except coffee and tea: no caffeine at supper (owner, 2026-09-25).
  it('gives supper exactly what it gives the afternoon snack, but no caffeine', () => {
    const caffeine = new Set(['cafe-descafeinado', 'cafe-solo', 'te-matcha', 'te-negro', 'te-verde']);

    for (const [slug, slots] of MEAL_ROWS) {
      expect(slots.includes('supper'), slug).toBe(slots.includes('afternoon_snack') && !caffeine.has(slug));
    }
  });

  it("carries the owner's review of 2026-09-25", () => {
    expect(mealSlotsFor({ slug: 'bebida-energetica' } as never)).toEqual(['none']);
    expect(mealSlotsFor({ slug: 'cafe-solo' } as never)).toEqual(['breakfast', 'morning_snack', 'afternoon_snack']);
    expect(mealSlotsFor({ slug: 'arroz-bomba-crudo' } as never)).toEqual(['lunch', 'dinner']);
    expect(mealSlotsFor({ slug: 'paella-congelada' } as never)).toEqual(['lunch']);
  });

  it('keeps stewed pulses off dinner, supper and breakfast', () => {
    for (const slug of ['lentejas-cocidas', 'garbanzos-cocidos', 'alubias-blancas-cocidas', 'fabada-en-lata']) {
      expect(mealSlotsFor({ slug } as never)).toEqual(['lunch']);
    }
  });

  it('leaves staples to every meal', () => {
    for (const slug of ['sal', 'aceite-de-oliva-virgen-extra', 'ajo', 'cebolla', 'limon', 'vinagre-de-jerez', 'perejil', 'huevo']) {
      expect(mealSlotsFor({ slug } as never), slug).toEqual([]);
    }
  });
});
