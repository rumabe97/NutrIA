import { describe, expect, it } from 'vitest';

import { normaliseForMatching } from 'core/domain/Safety';

import { DISHES, judged, picture, SEED_CATALOGUE } from '#test/dish-picture/acceptance';

import { FORM_FAMILIES, SERVING_WORDS } from './forms';

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
  // Gluten and milk, beside a rice-flour sponge. Not the catalogue's brownie: its walnuts are no cake's (`FormFamily.carries`).
  lemonCake: { cakes: ['Muffin'] },
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
  return [word, ...(word.endsWith('ies') ? [`${word.slice(0, -3)}y`] : []), ...(word.endsWith('s') && word.length > 3 ? [word.slice(0, -1)] : [])];
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

/** The allergens a product carries that the dish does not: contained and not contained by the dish, or may-contained and not carried at all (a sulphite a product only may contain never rejects). */
function beyondTheDish(key: (typeof DISH_KEYS)[number], product: string): readonly string[] {
  const own = DISHES[key].ingredients.flatMap(ingredient => SEED_CATALOGUE.find(entry => entry.slug === ingredient.slug) ?? []);
  const contains = new Set(own.flatMap(entry => entry.allergens));
  const carries = new Set(own.flatMap(entry => [...entry.allergens, ...(entry.mayContain ?? [])]));
  const entry = SEED_CATALOGUE.find(known => known.names[1] === product);

  return [
    ...(entry?.allergens ?? []).filter(allergen => !contains.has(allergen)),
    ...(entry?.mayContain ?? []).filter(allergen => !carries.has(allergen) && allergen !== 'sulphites')
  ];
}

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

  it.each(DISH_KEYS)('accepts beside %s only what carries nothing the dish lacks, and its own second batches', key => {
    const listed = Object.values(SECOND_BATCH[key] ?? {}).flat();
    const beyond = accepted(key).filter(product => beyondTheDish(key, product).length > 0);

    expect(beyond).toEqual(PRODUCTS.filter(product => listed.includes(product)));
    expect(accepted(key).length - beyond.length).toBe(CARRY_NOTHING_MORE[key]);
  });

  it.each(
    Object.entries(SECOND_BATCH).flatMap(([key, families]) =>
      Object.entries(families ?? {}).map(([family, products]) => [key, family, products] as const)
    )
  )('on %s, the %s family’s second batches carry nothing beyond the family’s closed set', (key, family, products) => {
    const carries = FORM_FAMILIES.find(known => known.family === family)?.carries ?? [];

    for (const product of products) {
      expect(beyondTheDish(key as (typeof DISH_KEYS)[number], product).filter(allergen => !carries.includes(allergen))).toEqual([]);
    }
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
