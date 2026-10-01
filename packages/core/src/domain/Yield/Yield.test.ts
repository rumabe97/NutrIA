import { describe, expect, it } from 'vitest';

import { INGREDIENT_SEED } from 'database/seed/ingredients';

import { COOKED_YIELDS, toDry, withoutCooked } from 'core/domain/Yield';

describe('COOKED_YIELDS', () => {
  const seeded = new Set(INGREDIENT_SEED.map(ingredient => ingredient.slug));

  it('holds the fifteen cooked grains and pastas of 0078', () => {
    expect(Object.keys(COOKED_YIELDS)).toHaveLength(15);
  });

  it('names only foods the seed has, cooked and dry', () => {
    for (const [cooked, { drySlug }] of Object.entries(COOKED_YIELDS)) {
      expect(seeded.has(cooked), cooked).toBe(true);

      if (drySlug !== null) {
        expect(seeded.has(drySlug), drySlug).toBe(true);
      }
    }
  });

  it('leaves cooked legumes alone — they are bought cooked, in jars', () => {
    expect(Object.keys(COOKED_YIELDS).filter(slug => /lentej|garbanz|alubia/u.test(slug))).toEqual([]);
  });
});

describe('toDry', () => {
  it('reads 600 g of cooked couscous as 240 g of dry couscous', () => {
    expect(toDry('cuscus-cocido', 600)).toEqual({ dryGrams: 240, drySlug: 'cuscus-crudo' });
  });

  it('maps cooked white rice to long-grain rice', () => {
    expect(toDry('arroz-blanco-cocido', 300)).toEqual({ dryGrams: 100, drySlug: 'arroz-largo-crudo' });
  });

  it('keeps a cooked pasta with no dry food in the catalogue, with no dry slug', () => {
    const dry = toDry('pasta-cocida', 230);

    expect(dry?.drySlug).toBeNull();
    expect(dry?.dryGrams).toBeCloseTo(100);
  });

  it('is null for anything that is not a cooked grain', () => {
    expect(toDry('lentejas-cocidas', 200)).toBeNull();
    expect(toDry('tomate', 200)).toBeNull();
  });
});

describe('withoutCooked', () => {
  it('drops the word in every agreement and in English', () => {
    expect(withoutCooked('Pasta cocida')).toBe('Pasta');
    expect(withoutCooked('Arroz blanco cocido')).toBe('Arroz blanco');
    expect(withoutCooked('Fideos de arroz cocidos')).toBe('Fideos de arroz');
    expect(withoutCooked('Cooked pasta')).toBe('Pasta');
  });

  it('leaves a name without the word as it is', () => {
    expect(withoutCooked('Cuscús')).toBe('Cuscús');
  });
});
