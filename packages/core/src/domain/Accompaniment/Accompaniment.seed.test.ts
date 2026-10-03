import { describe, expect, it } from 'vitest';

import { breaksPatternDish, NO_PREFERENCE_EXCLUSIONS, PATTERN_EXCLUDED_SLUGS, resolvePreferences } from 'core/domain/Preference';
import { toSafetyProfile } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { ACCOMPANIMENTS, larderFor, setsBeside } from './Accompaniment';

import type { AccompanimentDiner, Larder } from './Accompaniment';
import type { MealSlot } from 'core/entities/Plan';
import type { SafetyProfile } from 'core/entities/Safety';

import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';
import { seasonMonthsFor } from '../../../../database/src/seed/ingredients/seasons';

/**
 * Project 018 phase 3: the 39 new sides, on the real seed's rows — its
 * allergen links, its seasons, its macros — so a case cannot pass because a
 * fixture left a row out (`larderFor` drops a portion whose row it does not
 * know). Every "never offered" below is paired with "offered" to somebody
 * without the restriction. Allergen ids are the seed's keys.
 */
const catalogue = toCatalogue(
  INGREDIENT_SEED.map(row =>
    makeCatalogueIngredient({
      id: `i-${row.slug}`,
      allergens: (row.allergens ?? []).map(link => ({ allergenId: link.key, presence: link.presence ?? 'contains' })),
      carbsPer100g: row.carbs,
      category: row.category,
      fatPer100g: row.fat,
      fiberPer100g: row.fiber ?? 0,
      kcalPer100g: row.kcal,
      name: row.name,
      proteinPer100g: row.protein,
      seasonMonths: [...seasonMonthsFor(row)],
      slug: row.slug
    })
  )
);
const NOBODY = toSafetyProfile([], []);
const MAINS: readonly MealSlot[] = ['lunch', 'dinner'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function larder(safety: SafetyProfile = NOBODY, preferences: AccompanimentDiner['preferences'] = NO_PREFERENCE_EXCLUSIONS): Larder {
  return larderFor({ catalogue, preferences, safety });
}

function keysOf(of: Larder): Set<string> {
  return new Set(of.portions.map(portion => portion.accompaniment.key));
}

/** Every key ever offered beside this dish, at lunch and dinner, across the year. */
function offeredBeside(of: Larder, dish: Parameters<typeof setsBeside>[1]): Set<string> {
  return new Set(
    MAINS.flatMap(slot =>
      MONTHS.flatMap(month => setsBeside(of, dish, slot, month).flatMap(set => set.portions.map(portion => portion.accompaniment.key)))
    )
  );
}

function allergic(allergenId: string): SafetyProfile {
  return toSafetyProfile([{ allergenId, crossContaminationSensitive: false }], []);
}

const SPANISH_FISH = { cuisine: 'Española', ingredients: [{ grams: 150, slug: 'merluza' }], servings: 1 };

describe('the new sides on the real catalogue', () => {
  it('finds every row of every side, so nobody loses one in silence', () => {
    expect(larder().portions).toHaveLength(ACCOMPANIMENTS.flatMap(entry => entry.portions).length);
  });

  it.each([
    ['milk', ['pure-de-patata', 'yogur-con-miel']],
    ['gluten', ['salmorejo', 'pan-con-tomate', 'cuscus', 'espinacas-con-sesamo']],
    ['tree_nuts', ['espinacas-a-la-catalana']]
  ] as const)('never offers somebody allergic to %s the new sides that carry it, and offers them to everybody else', (allergen, keys) => {
    const everybody = keysOf(larder());
    const them = keysOf(larder(allergic(allergen)));

    for (const key of keys) {
      expect(everybody.has(key), key).toBe(true);
      expect(them.has(key), key).toBe(false);
    }
  });

  it('keeps the pine nuts of the Catalan spinach off a nut allergy at lunch and at dinner, beside a Spanish plate', () => {
    expect(offeredBeside(larder(), SPANISH_FISH).has('espinacas-a-la-catalana')).toBe(true);
    expect(offeredBeside(larder(allergic('tree_nuts')), SPANISH_FISH).has('espinacas-a-la-catalana')).toBe(false);
  });
});

describe('traditional Spanish never gets a foreign side', () => {
  const rows = [...catalogue.values()];
  const spanish = resolvePreferences({
    allergenIdsByKey: new Map(),
    dietaryPatterns: ['traditional_spanish'],
    dislikedLabels: [],
    ingredients: rows
  });
  const theirs = larder(NOBODY, spanish);
  const foreign = ACCOMPANIMENTS.filter(
    entry => entry.families !== 'all' && !entry.families.some(family => ['spanish', 'other', 'italian'].includes(family))
  );

  it('leaves out the new sides that hold a row 0077 lists, by their rows', () => {
    const forbidden = PATTERN_EXCLUDED_SLUGS.traditional_spanish ?? new Set<string>();
    const keys = keysOf(theirs);

    for (const key of ['yuca-con-mojo', 'platano-macho-al-horno', 'guacamole', 'kimchi', 'edamame', 'arroz-jazmin', 'espinacas-con-sesamo']) {
      expect(keysOf(larder()).has(key), key).toBe(true);
      expect(keys.has(key), key).toBe(false);
    }

    expect(theirs.portions.flatMap(portion => portion.items).filter(item => forbidden.has(item.slug))).toEqual([]);
  });

  // A couscous, an elote or a beetroot salad holds no 0077 row: only its family is foreign.
  it.each([
    ['Marroquí', ['cuscus', 'ensalada-de-zanahoria-marroqui', 'ensalada-de-remolacha', 'datiles', 'mutabal']],
    ['Mexicana', ['elote', 'curtido', 'ensalada-de-aguacate']],
    // Cuisines `cuisineFamily` reads as foreign that `breaksPatternDish` does not refuse: the plate reaches them, its foreign sides do not.
    ['Turca', ['cuscus', 'ensalada-de-zanahoria-marroqui']],
    ['Cubana', ['elote', 'curtido']]
  ] as const)('offers nothing foreign beside a %s dish, though everybody else gets its sides', (cuisine, keys) => {
    const dish = { ...SPANISH_FISH, cuisine };
    const everybody = offeredBeside(larder(), dish);
    const them = offeredBeside(theirs, dish);

    for (const key of keys) {
      expect(everybody.has(key), key).toBe(true);
    }

    expect(foreign.filter(entry => them.has(entry.key)).map(entry => entry.key)).toEqual([]);
  });

  it('is the guarantee: the dish filter refuses a Moroccan plate, but not every cuisine of a foreign family', () => {
    expect(breaksPatternDish({ cuisine: 'Marroquí', name: 'Pollo con verduras' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: 'Turca', name: 'Pollo con verduras' }, spanish)).toBe(false);
  });

  it('keeps their Spanish sides', () => {
    const them = offeredBeside(theirs, SPANISH_FISH);

    for (const key of ['crema-de-calabaza', 'pimientos-asados', 'pan-con-tomate', 'patata-cocida']) {
      expect(them.has(key), key).toBe(true);
    }
  });
});
