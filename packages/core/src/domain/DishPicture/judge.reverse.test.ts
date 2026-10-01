import { describe, expect, it } from 'vitest';

import { DISHES, judged, picture } from '#test/dish-picture/acceptance';

import { FORM_FAMILIES } from './forms';

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
 * Phase 2 moved these lists, and only by `ADDED_IN_PHASE_2`: every food it
 * added is a form of a family the dish has its own version of — a wheat roll
 * beside gluten-free bread — or the one vocabulary fix that lets a food
 * through (a sulphite king prawns only may contain, on a dish of prawns).
 * Nothing left a list. A later change that moves a list says, the same way,
 * why each food moved.
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

type Dish = keyof typeof DISHES;

/** For each dish, the extra foods the rule accepted beside it before project 010's phase 2. */
const ACCEPTED_BEFORE: Readonly<Partial<Record<Dish, readonly string[]>>> = {
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

/**
 * What phase 2 added, dish by dish, and why: the family of forms the dish has
 * its own version of (`forms.ts`) — by the ingredient or the title in the
 * comment — or the sulphite fix. A form beside the dish's own form under its
 * fuller name stays out: "bread" beside the toast's "gluten-free bread",
 * "pasta" beside "gluten-free pasta", "yogurt" beside "soya yoghurt", "cheese"
 * beside "vegan cheese" (project 006's second food).
 */
const ADDED_IN_PHASE_2: Readonly<Partial<Record<Dish, Readonly<Record<string, readonly string[]>>>>> = {
  cauliflowerPizza: { pastry: ['pizza base', 'pastry'] }, // the title's "pizza"
  coconutCurry: { cream: ['cream'], milk: ['milk'] }, // `leche-de-coco`
  cornTacos: { wraps: ['wrap', 'flatbread'] }, // `tortilla-de-maiz`
  glutenFreeBiscuits: { biscuits: ['cookies'] }, // `galletas-sin-gluten`
  glutenFreeSpaghetti: { pasta: ['noodles', 'spaghetti'] }, // `pasta-sin-gluten`
  glutenFreeToast: { bread: ['toast', 'bun', 'croutons'] }, // `pan-sin-gluten`
  heuraNuggets: { meat: ['meatballs', 'burger patty'], nuggets: ['nuggets', 'croquettes'] }, // `heura`; the title's "nuggets"
  heuraStirFry: { meat: ['meatballs', 'burger patty'] }, // `heura`
  prawnsWithRice: { sulphites: ['king prawns'] }, // a sulphite they only may contain, beside prawns
  riceCakes: { crackers: ['crackers'] }, // `tortitas-de-arroz`
  ricePancakes: { pancakes: ['pancakes', 'waffles'] }, // the title's "tortitas", on a dish with no rice or corn cakes
  soyMilkShake: { milk: ['milk'] } // `leche-de-soja`
};

describe('judgePicture — the reverse measure: one more food on an example dish', () => {
  it('measures 63 foods on 20 dishes', () => {
    expect(new Set(EXTRA_FOODS).size).toBe(63);
    expect(Object.keys(ACCEPTED_BEFORE)).toHaveLength(20);
  });

  it.each(Object.entries(ACCEPTED_BEFORE) as [Dish, readonly string[]][])(
    'accepts on %s the foods it accepted before, and those phase 2 added, only',
    (key, before) => {
      const recipe = DISHES[key];
      const added = Object.values(ADDED_IN_PHASE_2[key] ?? {}).flat();

      expect(EXTRA_FOODS.filter(food => judged(recipe, picture(recipe, { name: food })).accepted)).toEqual(
        EXTRA_FOODS.filter(food => before.includes(food) || added.includes(food))
      );
    }
  );

  it('accepted 83 of the 1,260 pairs before phase 2, and accepts 106: 22 through a dish’s own form, 1 through the sulphite fix', () => {
    const added = Object.values(ADDED_IN_PHASE_2).flatMap(families => Object.entries(families ?? {}));
    const byOwnForm = added.filter(([family]) => family !== 'sulphites').flatMap(([, foods]) => foods);
    const bySulphites = added.filter(([family]) => family === 'sulphites').flatMap(([, foods]) => foods);

    expect(added.every(([family]) => family === 'sulphites' || FORM_FAMILIES.some(known => known.family === family))).toBe(true);
    expect([Object.values(ACCEPTED_BEFORE).flat().length, byOwnForm.length, bySulphites.length]).toEqual([83, 22, 1]);
    expect(Object.values(ACCEPTED_BEFORE).flat().length + byOwnForm.length + bySulphites.length).toBe(106);
  });
});
