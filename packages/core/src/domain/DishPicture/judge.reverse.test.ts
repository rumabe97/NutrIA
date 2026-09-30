import { describe, expect, it } from 'vitest';

import { DISHES, judged, picture } from '#test/dish-picture/acceptance';

/*
 * The reverse measure (project 010, PRD 6; report `0006` § 5.4): what the rule
 * lets through. Each example dish is drawn faithfully, then with one more food
 * the match call lists as an extra — a main, and named specifically, the
 * hardest case for the rule. The foods are the report's 63, each carrying an
 * allergen. Pinned here: which of them each dish accepts with today's rule.
 *
 * The dishes are twenty of `DISHES`: one for each family of forms a dish can
 * have its own version of (by an ingredient, or by its title where the family
 * has no ingredient), and five that have none, with and without allergens of
 * their own. Twenty, not all of them: every pair rebuilds the rule's index of
 * the whole catalogue, about 5 ms, and 1,260 pairs is what the suite can
 * carry.
 *
 * Each extra food sits beside the dish's own foods, seen under their own
 * names: "bread" beside "gluten-free bread" is the second-food case, which
 * stays rejected. So these numbers measure a different scene from the
 * report's 229 pairs, where the extra stood alone, and are not meant to
 * reconcile with them.
 *
 * Phase 2 moves these lists. Every food it adds must be a form of the same
 * family as one the dish already has — a wheat roll beside gluten-free bread —
 * and is explained family by family in the log, as the library's 229 pairs
 * are; a food that is not is the rule excusing too much. Nothing may leave a
 * list unexplained either.
 */
const EXTRA_FOODS = [
  'bread',
  'toast',
  'bun',
  'croutons',
  'breadcrumbs',
  'pancakes',
  'waffles',
  'cake',
  'cookies',
  'crackers',
  'pizza base',
  'pastry',
  'pasta',
  'noodles',
  'spaghetti',
  'wheat tortilla',
  'wrap',
  'flatbread',
  'meatballs',
  'burger patty',
  'nuggets',
  'croquettes',
  'milk',
  'yogurt',
  'cheese',
  'grated cheese',
  'feta cheese',
  'mozzarella',
  'parmesan',
  'cream',
  'butter',
  'egg',
  'fried egg',
  'shrimp',
  'prawns',
  'king prawns',
  'mussels',
  'squid',
  'salmon',
  'tuna',
  'peanuts',
  'walnuts',
  'almonds',
  'sesame seeds',
  'tofu',
  'soy sauce',
  'mustard',
  'celery',
  'sunflower seeds',
  'pumpkin seeds',
  'dark chocolate',
  'oats',
  'couscous',
  'seitan',
  'peanut butter',
  'mayonnaise',
  'hummus',
  'pesto',
  'surimi',
  'sausages',
  'chocolate chips',
  'granola',
  'cornflakes'
] as const;

/** For each dish, the extra foods today's rule accepts beside it. */
const ACCEPTED_TODAY: Readonly<Partial<Record<keyof typeof DISHES, readonly string[]>>> = {
  cauliflowerPizza: ['egg', 'fried egg', 'mayonnaise', 'sausages'],
  chickenWithRice: ['sausages'],
  coconutCurry: ['sausages'],
  cornTacos: ['sausages'],
  fruitSalad: ['sausages'],
  glutenFreeBiscuits: ['sausages', 'chocolate chips'],
  glutenFreeBreaded: ['sausages'],
  glutenFreeSpaghetti: ['sausages'],
  glutenFreeToast: ['sausages'],
  heuraNuggets: ['tofu', 'sausages'],
  heuraStirFry: ['tofu', 'sausages'],
  lentilStew: ['sausages'],
  prawnsWithRice: ['shrimp', 'prawns', 'sausages'],
  riceCakes: ['sesame seeds', 'hummus', 'sausages'],
  ricePancakes: ['egg', 'fried egg', 'mayonnaise', 'sausages'],
  soyMilkShake: ['tofu', 'sausages'],
  soyYoghurt: ['walnuts', 'almonds', 'tofu', 'sunflower seeds', 'pumpkin seeds', 'sausages'],
  veganCheeseSalad: ['sausages'],
  wheatSpaghetti: [
    'bread',
    'toast',
    'bun',
    'croutons',
    'breadcrumbs',
    'pizza base',
    'pastry',
    'pasta',
    'noodles',
    'spaghetti',
    'wheat tortilla',
    'wrap',
    'flatbread',
    'burger patty',
    'milk',
    'yogurt',
    'cheese',
    'grated cheese',
    'feta cheese',
    'mozzarella',
    'parmesan',
    'cream',
    'butter',
    'oats',
    'couscous',
    'seitan',
    'sausages',
    'cornflakes'
  ],
  yoghurtWithOats: [
    'burger patty',
    'milk',
    'yogurt',
    'cheese',
    'grated cheese',
    'feta cheese',
    'mozzarella',
    'parmesan',
    'cream',
    'butter',
    'walnuts',
    'almonds',
    'sunflower seeds',
    'pumpkin seeds',
    'oats',
    'pesto',
    'sausages',
    'cornflakes'
  ]
};

describe('judgePicture — the reverse measure: one more food on an example dish', () => {
  it('measures 63 foods on 20 dishes', () => {
    expect(new Set(EXTRA_FOODS).size).toBe(63);
    expect(Object.keys(ACCEPTED_TODAY)).toHaveLength(20);
  });

  it.each(Object.entries(ACCEPTED_TODAY) as [keyof typeof DISHES, readonly string[]][])(
    'accepts on %s only the foods pinned for it',
    (key, accepted) => {
      const recipe = DISHES[key];

      expect(EXTRA_FOODS.filter(food => judged(recipe, picture(recipe, { name: food })).accepted)).toEqual(accepted);
    }
  );

  it('accepts 83 of the 1,260 pairs today', () => {
    expect(Object.values(ACCEPTED_TODAY).flat()).toHaveLength(83);
  });
});
