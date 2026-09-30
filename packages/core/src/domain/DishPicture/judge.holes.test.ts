import { describe, expect, it } from 'vitest';

import { dish, judged, picture } from '#test/dish-picture/acceptance';

/*
 * The holes (project 010, PRD 8; report `0006` § 5.6): names of foods that
 * anyone would expect to carry an allergen and that today's rule maps to
 * none, so a pizza drawn on a dish with no gluten passes. Each name is read as
 * an extra food on a dish of water, which carries nothing: what it maps to is
 * all that counts.
 *
 * `EXPECTED` is the report's list of 166 such names, by the allergen their
 * usual recipe carries. `HOLES` is the ones that miss it today — 19 — and the
 * last test says those are the only ones, so a change to the rule cannot make
 * them 20 unnoticed. Phase 5 closes them name by name: a row leaves `HOLES`,
 * or stays with the reason it is left open, and the last test then holds the
 * name to its allergen.
 */
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  celery: ['celery', 'celery sticks'],
  crustaceans: ['shrimp', 'prawns', 'king prawns', 'lobster', 'crab', 'langoustine', 'crayfish'],
  eggs: [
    'egg',
    'fried egg',
    'boiled egg',
    'poached egg',
    'scrambled eggs',
    'omelette',
    'omelet',
    'frittata',
    'egg yolk',
    'mayonnaise',
    'aioli',
    'meringue',
    'hollandaise',
    'quiche',
    'egg noodles'
  ],
  fish: [
    'salmon',
    'tuna',
    'cod',
    'hake',
    'anchovies',
    'sardines',
    'white fish',
    'fish fillet',
    'smoked salmon',
    'mackerel',
    'trout',
    'sea bass',
    'fish'
  ],
  gluten: [
    'bread',
    'toast',
    'bun',
    'baguette',
    'bagel',
    'pita bread',
    'naan',
    'wrap',
    'flour tortilla',
    'wheat tortilla',
    'tortilla',
    'pizza',
    'pizza crust',
    'pizza slice',
    'pastry',
    'puff pastry',
    'pie',
    'tart',
    'quiche',
    'croissant',
    'pancakes',
    'crepes',
    'crepe',
    'waffles',
    'cake',
    'cupcake',
    'muffin',
    'brownie',
    'cookies',
    'biscuits',
    'crackers',
    'pretzel',
    'breadsticks',
    'croutons',
    'breadcrumbs',
    'breaded chicken',
    'battered fish',
    'dumplings',
    'gyoza',
    'pasta',
    'spaghetti',
    'penne',
    'fusilli',
    'macaroni',
    'lasagna',
    'ravioli',
    'gnocchi',
    'noodles',
    'ramen',
    'udon',
    'egg noodles',
    'couscous',
    'bulgur',
    'seitan',
    'burrito',
    'sandwich',
    'fritters',
    'crumble',
    'granola',
    'muesli',
    'cereal',
    'barley',
    'soy sauce',
    'beer'
  ],
  milk: [
    'milk',
    'glass of milk',
    'yogurt',
    'greek yogurt',
    'cheese',
    'grated cheese',
    'melted cheese',
    'feta',
    'feta cheese',
    'mozzarella',
    'parmesan',
    'cottage cheese',
    'cream cheese',
    'ricotta',
    'halloumi',
    'paneer',
    'goat cheese',
    'blue cheese',
    'cream',
    'whipped cream',
    'sour cream',
    'butter',
    'ice cream',
    'custard',
    'milkshake',
    'latte',
    'cheese sauce',
    'bechamel',
    'white chocolate',
    'milk chocolate'
  ],
  molluscs: ['mussels', 'clams', 'squid', 'calamari', 'octopus', 'scallops', 'oysters', 'cuttlefish'],
  mustard: ['mustard', 'mustard seeds'],
  peanuts: ['peanuts', 'peanut butter', 'peanut sauce', 'crushed peanuts'],
  sesame: ['sesame seeds', 'tahini', 'sesame', 'hummus'],
  soy: ['tofu', 'tempeh', 'edamame', 'soy sauce', 'miso', 'soy beans'],
  tree_nuts: ['almonds', 'walnuts', 'hazelnuts', 'cashews', 'pistachios', 'pine nuts', 'pecans', 'nuts', 'chopped nuts', 'almond flakes', 'pesto']
};

const HOLES: readonly (readonly [name: string, allergen: string])[] = [
  ['tortilla', 'gluten'],
  ['pizza', 'gluten'],
  ['pizza crust', 'gluten'],
  ['pizza slice', 'gluten'],
  ['tart', 'gluten'],
  ['crepes', 'gluten'],
  ['crepe', 'gluten'],
  ['cupcake', 'gluten'],
  ['fusilli', 'gluten'],
  ['burrito', 'gluten'],
  ['fritters', 'gluten'],
  ['crumble', 'gluten'],
  ['paneer', 'milk'],
  ['latte', 'milk'],
  ['omelet', 'eggs'],
  ['frittata', 'eggs'],
  ['meringue', 'eggs'],
  ['hollandaise', 'eggs'],
  ['crayfish', 'crustaceans']
];

const WATER = dish('Agua', ['agua', 100]);

function foreignAllergens(name: string): readonly string[] {
  return judged(WATER, picture(WATER, { name })).extras.find(extra => extra.name === name)?.foreignAllergens ?? [];
}

describe('judgePicture — the names that carry an allergen and map to none', () => {
  it('reads 166 names', () => {
    expect(Object.values(EXPECTED).flat()).toHaveLength(166);
  });

  it.each(HOLES)('"%s" does not carry %s today', (name, allergen) => {
    expect(foreignAllergens(name)).not.toContain(allergen);
  });

  it('has no hole beyond those 19', () => {
    const missed = Object.entries(EXPECTED).flatMap(([allergen, names]) =>
      names.filter(name => !foreignAllergens(name).includes(allergen)).map(name => [name, allergen] as const)
    );

    const byName = (pairs: readonly (readonly [string, string])[]) => pairs.map(([name, allergen]) => `${name}=${allergen}`).sort();

    expect(byName(missed)).toEqual(byName(HOLES));
  });
});
