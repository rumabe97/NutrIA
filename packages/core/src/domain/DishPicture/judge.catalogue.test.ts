import { describe, expect, it } from 'vitest';

import { normaliseForMatching } from 'core/domain/Safety';

import { DISHES, judged, picture, SEED_CATALOGUE } from '#test/dish-picture/acceptance';

import { BARE_FORMS, FORM_FAMILIES, SERVING_WORDS } from './forms';

import type { PictureCatalogueEntry } from 'core/domain/DishPicture';

/*
 * The exhaustive measure (project 010, phase 2's third round): every product
 * of the seed catalogue whose English name holds a word of a family's rows —
 * "Whole milk", "Cream cheese", "Milk roll", "Burger bun", "Brownie" — drawn
 * as one more food beside each example dish. It is how the rule converges: a
 * reviewer's probe is a name somebody thought of; this is every name the
 * catalogue has.
 *
 * Every pair the rule accepts is one of two kinds, and nothing else:
 *   - the product carries no allergen the dish lacks, so accepting it is
 *     right whatever the rule's reason; or
 *   - it is listed below, by dish and family: a second batch of the form the
 *     dish has its own version of, accepted because a picture cannot tell the
 *     two apart (`0073`, Consequences) — spaghetti beside gluten-free pasta.
 *
 * A new catalogue product that holds a form's word changes the count and is
 * judged here before it reaches production; a row added to a family that
 * lets one more product through shows up as a new line of `SECOND_BATCH`.
 */
const DISH_KEYS = [
  // The twenty dishes of the reverse measure (`judge.reverse.test.ts`)…
  'cauliflowerPizza',
  'chickenWithRice',
  'coconutCurry',
  'cornTacos',
  'fruitSalad',
  'glutenFreeBiscuits',
  'glutenFreeBreaded',
  'glutenFreeSpaghetti',
  'glutenFreeToast',
  'heuraNuggets',
  'heuraStirFry',
  'lentilStew',
  'prawnsWithRice',
  'riceCakes',
  'ricePancakes',
  'soyMilkShake',
  'soyYoghurt',
  'veganCheeseSalad',
  'wheatSpaghetti',
  'yoghurtWithOats',
  // …and the one family they leave without a dish of its own.
  'lemonCake'
] as const satisfies readonly (keyof typeof DISHES)[];

/** For each family, the example dish that has its own version of it. */
const DISH_OF_FAMILY: Readonly<Record<string, (typeof DISH_KEYS)[number]>> = {
  biscuits: 'glutenFreeBiscuits',
  bread: 'glutenFreeToast',
  breading: 'glutenFreeBreaded',
  cakes: 'lemonCake',
  cheese: 'veganCheeseSalad',
  crackers: 'riceCakes',
  cream: 'coconutCurry',
  meat: 'heuraStirFry',
  milk: 'soyMilkShake',
  nuggets: 'heuraNuggets',
  pancakes: 'ricePancakes',
  pasta: 'glutenFreeSpaghetti',
  pastry: 'cauliflowerPizza',
  wraps: 'cornTacos',
  yogurt: 'soyYoghurt'
};

/** The pairs accepted although the product carries an allergen the dish lacks: a second batch of the dish's own form, by family. */
const SECOND_BATCH: Readonly<Partial<Record<(typeof DISH_KEYS)[number], Readonly<Record<string, readonly string[]>>>>> = {
  glutenFreeSpaghetti: { pasta: ['Macaroni', 'Spaghetti'] }, // gluten, beside gluten-free pasta
  glutenFreeToast: { bread: ['Baguette'] }, // gluten, beside gluten-free bread
  // Gluten and milk, beside a rice-flour sponge. "Brownie" since phase 5, the bare word being a brownie with nothing in it: its tree nuts are a bare drop (`BARE_DROPS`).
  lemonCake: { cakes: ['Brownie', 'Muffin'] },
  riceCakes: { crackers: ['Crackers'] }, // gluten, beside rice cakes
  ricePancakes: { pancakes: ['Waffle'] } // gluten and milk, beside rice-flour pancakes
};

/** How many products each dish accepts that carry nothing it lacks. */
const CARRY_NOTHING_MORE: Readonly<Record<(typeof DISH_KEYS)[number], number>> = {
  cauliflowerPizza: 33,
  chickenWithRice: 33,
  coconutCurry: 33,
  cornTacos: 33,
  fruitSalad: 33,
  glutenFreeBiscuits: 34,
  glutenFreeBreaded: 33,
  glutenFreeSpaghetti: 33,
  glutenFreeToast: 33,
  heuraNuggets: 36,
  heuraStirFry: 36,
  lemonCake: 33,
  lentilStew: 33,
  prawnsWithRice: 33,
  riceCakes: 33,
  ricePancakes: 33,
  soyMilkShake: 36,
  soyYoghurt: 37,
  veganCheeseSalad: 33,
  wheatSpaghetti: 128,
  yoghurtWithOats: 88
};

/** A word and its singular, as the rule reads a plural. */
function singular(word: string): readonly string[] {
  return [
    word,
    ...(word.endsWith('ies') ? [`${word.slice(0, -3)}y`] : []),
    ...(/(ch|sh|ss|us|x|z)es$/.test(word) ? [word.slice(0, -2)] : []),
    ...(word.endsWith('s') && word.length > 3 ? [word.slice(0, -1)] : [])
  ];
}

function sameWord(a: string, b: string): boolean {
  return singular(a).some(form => singular(b).includes(form));
}

const FORM_WORDS = [...new Set(FORM_FAMILIES.flatMap(family => family.seen.flatMap(row => row.split(' '))))];
const PRODUCTS = [
  ...new Set(
    SEED_CATALOGUE.map(entry => entry.names[1] as string).filter(name =>
      normaliseForMatching(name)
        .split(' ')
        .some(word => FORM_WORDS.some(form => sameWord(word, form)))
    )
  )
].sort();

/** Whether a product's name is a form's word alone (`BARE_FORMS`, phase 5), which the rule reads as the form with nothing in it. */
function isBareForm(product: string): boolean {
  return singular(normaliseForMatching(product)).some(word => BARE_FORMS.has(word));
}

/** The catalogue's own entry for a product, by its English name: what the product really holds, whatever the rule reads its name as. */
function entryOf(product: string): PictureCatalogueEntry | undefined {
  return SEED_CATALOGUE.find(known => known.names[1] === product);
}

/** The allergens a product carries that the dish does not: contained and not contained by the dish, or may-contained and not carried at all (a sulphite a product only may contain never rejects). */
function beyondTheDish(key: (typeof DISH_KEYS)[number], product: string): readonly string[] {
  const own = DISHES[key].ingredients.flatMap(ingredient => SEED_CATALOGUE.find(entry => entry.slug === ingredient.slug) ?? []);
  const contains = new Set(own.flatMap(entry => entry.allergens));
  const carries = new Set(own.flatMap(entry => [...entry.allergens, ...(entry.mayContain ?? [])]));
  const entry = entryOf(product);

  return [
    ...(entry?.allergens ?? []).filter(allergen => !contains.has(allergen)),
    ...(entry?.mayContain ?? []).filter(allergen => !carries.has(allergen) && allergen !== 'sulphites')
  ];
}

/**
 * What a bare form's word drops (phase 5, `BARE_FORMS`): a product named by
 * the word alone, accepted although the catalogue says it may contain an
 * allergen the dish lacks. A picture shows a brownie, never that it may
 * contain nuts; it is the cost of reading a bare word as the form with
 * nothing in it, listed here dish by dish so that it cannot grow unseen. Each
 * dropped allergen is one the product only *may* contain, never one it
 * contains (the last test).
 */
const BARE_DROPS: Readonly<Partial<Record<(typeof DISH_KEYS)[number], Readonly<Record<string, readonly string[]>>>>> = {
  lemonCake: { Brownie: ['tree_nuts'] }, // and its gluten and milk, the cakes family's own
  wheatSpaghetti: { Crackers: ['sesame'] } // its gluten is the dish's
};

/** Whether a product's name, set aside how it is served, is a row of the family. */
function isRowOf(family: string, product: string): boolean {
  const bare = normaliseForMatching(product)
    .split(' ')
    .filter(word => !SERVING_WORDS.includes(word));

  return (FORM_FAMILIES.find(known => known.family === family)?.seen ?? []).some(row => {
    const words = row.split(' ');

    return words.length === bare.length && words.every((word, index) => sameWord(bare[index] as string, word));
  });
}

describe('judgePicture — every catalogue product that holds a form’s word, beside each example dish', () => {
  const verdictsOf = (key: (typeof DISH_KEYS)[number]) =>
    new Map(PRODUCTS.map(product => [product, judged(DISHES[key], picture(DISHES[key], { name: product }))]));

  const accepted = (key: (typeof DISH_KEYS)[number]) => {
    const verdicts = verdictsOf(key);

    return PRODUCTS.filter(product => verdicts.get(product)?.accepted === true);
  };

  it('reads 175 products of the seed catalogue, beside 21 dishes: one per family at least', () => {
    expect(PRODUCTS).toHaveLength(175);
    expect(Object.keys(DISH_OF_FAMILY).sort()).toEqual(FORM_FAMILIES.map(family => family.family).sort());
  });

  // A new product named by a form's word alone is read as the bare form, and shows up here.
  it('reads two products by a form’s word alone, as the form with nothing in it', () => {
    expect(PRODUCTS.filter(isBareForm)).toEqual(['Brownie', 'Crackers']);
  });

  it.each(DISH_KEYS)('accepts beside %s only what carries nothing the dish lacks, its own second batches and its bare drops', key => {
    const listed = [...Object.values(SECOND_BATCH[key] ?? {}).flat(), ...Object.keys(BARE_DROPS[key] ?? {})];
    const beyond = accepted(key).filter(product => beyondTheDish(key, product).length > 0);

    expect(beyond).toEqual(PRODUCTS.filter(product => listed.includes(product)));
    expect(accepted(key).length - beyond.length).toBe(CARRY_NOTHING_MORE[key]);
  });

  it.each(
    Object.entries(SECOND_BATCH).flatMap(([key, families]) =>
      Object.entries(families ?? {}).map(([family, products]) => [key, family, products] as const)
    )
  )('on %s, the %s family’s second batches carry nothing beyond the family’s closed set, but a bare drop', (key, family, products) => {
    const carries = FORM_FAMILIES.find(known => known.family === family)?.carries ?? [];

    for (const product of products) {
      const dropped = BARE_DROPS[key as (typeof DISH_KEYS)[number]]?.[product] ?? [];

      expect(
        beyondTheDish(key as (typeof DISH_KEYS)[number], product).filter(allergen => !carries.includes(allergen) && !dropped.includes(allergen))
      ).toEqual([]);
    }
  });

  it.each(
    Object.entries(BARE_DROPS).flatMap(([key, products]) =>
      Object.entries(products ?? {}).map(([product, dropped]) => [key as (typeof DISH_KEYS)[number], product, dropped] as const)
    )
  )('on %s, "%s" is a bare form that drops %j: allergens it only may contain', (key, product, dropped) => {
    const family = FORM_FAMILIES.find(known => known.seen.some(row => singular(normaliseForMatching(product)).includes(row)));
    const entry = entryOf(product);

    expect(isBareForm(product)).toBe(true);
    expect(beyondTheDish(key, product).filter(allergen => !(family?.carries ?? []).includes(allergen))).toEqual(dropped);
    expect(dropped.every(allergen => (entry?.mayContain ?? []).includes(allergen) && !(entry?.allergens ?? []).includes(allergen))).toBe(true);
  });

  it.each(
    Object.entries(SECOND_BATCH).flatMap(([key, families]) =>
      Object.entries(families ?? {}).flatMap(([family, products]) =>
        products.map(product => [key as (typeof DISH_KEYS)[number], family, product] as const)
      )
    )
  )('on %s, accepts the %s family’s "%s" as its own form, and says so', (key, family, product) => {
    expect(DISH_OF_FAMILY[family]).toBe(key);
    expect(isRowOf(family, product)).toBe(true);
    expect(judged(DISHES[key], picture(DISHES[key], { name: product })).notes).toContain(`own_form:${product}`);
  });
});
