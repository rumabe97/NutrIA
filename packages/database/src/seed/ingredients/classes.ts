import type { FoodClass, IngredientSeed } from './types';

/**
 * Every class a row belongs to: what it tags, what its allergens reveal, and
 * what those imply — pork is meat, and all of them are animal.
 *
 * Lived in `seed.test.ts` while nothing but the substitution audit needed it.
 * The seed now writes the result to a column (`ingredients.classes`), so a way
 * of eating and a dislike are enforced against the same derivation the audit
 * checks, rather than against a second one that agrees until it does not.
 */
export function foodClasses(entry: IngredientSeed): ReadonlySet<FoodClass> {
  const classes = new Set<FoodClass>(entry.classes ?? []);
  const allergens = new Set((entry.allergens ?? []).filter(link => (link.presence ?? 'contains') === 'contains').map(link => link.key));

  if (allergens.has('milk') || allergens.has('lactose')) {classes.add('dairy');}

  if (allergens.has('eggs')) {classes.add('egg');}

  if (allergens.has('fish')) {classes.add('fish');}

  if (allergens.has('crustaceans') || allergens.has('molluscs')) {classes.add('shellfish');}

  if (classes.has('pork')) {classes.add('meat');}

  if (classes.size > 0) {classes.add('animal');}

  return classes;
}
