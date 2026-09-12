import { normaliseForMatching } from 'core/domain/Safety';

import type { CatalogueIngredient } from 'core/entities/Plan';
import type { FoodClass } from 'database/schema/food';

/**
 * What a way of eating excludes, as classes of food rather than as a sentence
 * in a prompt.
 *
 * A person who declares themselves vegetarian and is served chicken has been
 * failed by the product, not by the model — the model was asked politely and
 * ignored. These are the same kind of rule as the allergy gate and run in the
 * same place: before a dish can be proposed, not after it is on the plate.
 *
 * Absent on purpose: `halal` and `kosher`, which are not a class of food but a
 * way of raising and preparing it, and the catalogue holds nothing that could
 * enforce them; `flexitarian`, which is a direction rather than a rule; and
 * `gluten_free` / `lactose_free`, which name allergens the safety layer already
 * enforces when declared as an intolerance. What cannot be enforced is said to
 * the model and reported as best-effort, never as applied.
 */
export const PATTERN_EXCLUSIONS: Readonly<Record<string, readonly FoodClass[]>> = {
  pescatarian: ['meat', 'pork'],
  vegan: ['animal', 'dairy', 'egg', 'fish', 'meat', 'pork', 'shellfish'],
  vegetarian: ['fish', 'meat', 'pork', 'shellfish']
};

/**
 * The words people use for a whole family of food, and the classes each names.
 *
 * The mirror image of the allergy synonym list, and deliberately so: there, a
 * group word is refused because narrowing "marisco" to prawns would leave
 * mussels on the plate of someone who could die of them. Here the group word is
 * *expanded* — the risk runs the other way. Someone who says they dislike fish
 * and is served hake has been ignored; someone who dislikes fish and is served
 * no seafood at all has been understood.
 */
const GROUP_LABELS: ReadonlyMap<string, readonly FoodClass[]> = new Map([
  ['carne', ['meat', 'pork']],
  ['carnes', ['meat', 'pork']],
  ['cerdo', ['pork']],
  ['embutido', ['pork']],
  ['embutidos', ['pork']],
  ['huevo', ['egg']],
  ['huevos', ['egg']],
  ['lacteos', ['dairy']],
  ['leche', ['dairy']],
  ['marisco', ['shellfish']],
  ['mariscos', ['shellfish']],
  ['pescado', ['fish']],
  ['pescados', ['fish']],
  ['pescado y marisco', ['fish', 'shellfish']]
]);

/**
 * Whether a dislike is a promise or a request — the same question
 * `resolvePreferences` answers while building a plan, asked without one.
 *
 * Deliberately needs no catalogue classes and no macros: a group word is known
 * from the map, and everything else is an exact name or slug. That keeps it
 * cheap enough to run on a profile screen, and it is the *same* rule, not a
 * second one that agrees until it does not.
 */
export function isEnforceableDislike(label: string, ingredients: readonly { readonly name: string; readonly slug: string }[]): boolean {
  const key = normaliseForMatching(label);

  if (key === '') {
    return false;
  }

  if (GROUP_LABELS.has(key)) {
    return true;
  }

  return ingredients.some(ingredient => normaliseForMatching(ingredient.name) === key || normaliseForMatching(ingredient.slug) === key);
}

export type PreferenceExclusions = {
  /** Every catalogue row a way of eating or a dislike rules out. */
  readonly excludedIngredientIds: ReadonlySet<string>;
  /**
   * The longest a dish may take, prep plus cooking, or null when they set none.
   *
   * Enforced rather than asked for the reason the whole of `0023` exists: a
   * person who says thirty minutes and is handed a fifty-minute stew has been
   * ignored, and the model is the wrong place to guarantee it.
   */
  readonly maxMinutesPerDish: number | null;
  /**
   * Foods they said they like, as catalogue slugs.
   *
   * Not a rule: a like cannot be enforced the way a dislike can — you can serve
   * someone salmon, you cannot make them enjoy it. It is a weight on the pick
   * (0026), which is why these are slugs for the rotation rather than ids for a
   * filter.
   */
  readonly preferredIngredientSlugs: ReadonlySet<string>;
  /** Dislikes that named nothing the catalogue knows. Asked of the model, never claimed as applied. */
  readonly unenforceableLabels: readonly string[];
};

/**
 * Every catalogue row a label names, or null when it names nothing the
 * catalogue knows.
 *
 * The two are different answers and the caller needs both: an empty list from a
 * word we understand ("pescado" on a catalogue with no fish) still keeps its
 * promise; a null means all we can do is ask the model.
 */
function named(
  raw: string,
  ingredients: readonly CatalogueIngredient[],
  byKey: ReadonlyMap<string, CatalogueIngredient>
): readonly CatalogueIngredient[] | null {
  const key = normaliseForMatching(raw.trim());

  if (key === '') {
    return null;
  }

  const group = GROUP_LABELS.get(key);

  if (group) {
    const wanted = new Set(group);

    return ingredients.filter(ingredient => inClasses(ingredient, wanted));
  }

  const match = byKey.get(key);

  if (!match) {
    return null;
  }

  // The row itself and everything made of it, by the same whole-token rule the
  // allergy layer uses: `salmon` is a run inside `salmon-ahumado`, and is not a
  // run inside `salmonete`.
  const run = match.slug.split('-');

  return ingredients.filter(ingredient => {
    const tokens = ingredient.slug.split('-');

    return tokens.some((_token, start) => run.every((word, offset) => tokens[start + offset] === word));
  });
}

/** Whether an ingredient belongs to any of these classes. */
function inClasses(ingredient: CatalogueIngredient, classes: ReadonlySet<FoodClass>): boolean {
  return ingredient.classes.some(cls => classes.has(cls));
}

/**
 * The catalogue rows a person's *preferences* exclude — their way of eating and
 * the things they said they dislike.
 *
 * Three ways a dislike resolves, in order:
 *   1. the exact name or slug of a catalogue row, and everything made of it —
 *      "salmón" reaches `salmon-ahumado` and `salmon-congelado`;
 *   2. a group word, through `GROUP_LABELS` — "pescado" reaches every fish;
 *   3. nothing, in which case the label is returned as unenforceable.
 *
 * This is a preference, not a safety rule, and the two are kept apart on
 * purpose: a stored plan is never re-judged against it, no violation is
 * reported for one, and a dish rejected here is rejected quietly.
 */
export function resolvePreferences(input: {
  readonly dietaryPatterns: readonly string[];
  readonly dislikedLabels: readonly string[];
  readonly ingredients: readonly CatalogueIngredient[];
  readonly likedLabels?: readonly string[];
  readonly maxMinutesPerDish?: number | null;
}): PreferenceExclusions {
  const classes = new Set<FoodClass>(input.dietaryPatterns.flatMap(pattern => PATTERN_EXCLUSIONS[pattern] ?? []));
  const excluded = new Set<string>();
  const unenforceable: string[] = [];

  if (classes.size > 0) {
    for (const ingredient of input.ingredients) {
      if (inClasses(ingredient, classes)) {
        excluded.add(ingredient.id);
      }
    }
  }

  const byKey = new Map<string, CatalogueIngredient>();

  for (const ingredient of input.ingredients) {
    for (const key of [normaliseForMatching(ingredient.name), normaliseForMatching(ingredient.slug)]) {
      if (key !== '' && !byKey.has(key)) {
        byKey.set(key, ingredient);
      }
    }
  }

  for (const raw of input.dislikedLabels) {
    const rows = named(raw, input.ingredients, byKey);

    if (rows === null) {
      unenforceable.push(raw.trim());
      continue;
    }

    for (const ingredient of rows) {
      excluded.add(ingredient.id);
    }
  }

  const preferred = new Set<string>();

  for (const raw of input.likedLabels ?? []) {
    for (const ingredient of named(raw, input.ingredients, byKey) ?? []) {
      preferred.add(ingredient.slug);
    }
  }

  return {
    excludedIngredientIds: excluded,
    maxMinutesPerDish: input.maxMinutesPerDish ?? null,
    preferredIngredientSlugs: preferred,
    unenforceableLabels: unenforceable
  };
}

/** Nothing excluded — for a caller with no profile to read, and for tests. */
export const NO_PREFERENCE_EXCLUSIONS: PreferenceExclusions = {
  excludedIngredientIds: new Set(),
  maxMinutesPerDish: null,
  preferredIngredientSlugs: new Set(),
  unenforceableLabels: []
};

/**
 * The most minutes a dish may take and still be offered to someone whose
 * limit is `limit`: the limit plus a fifth, rounded up to the next ten.
 *
 * The minutes on a dish are an estimate — the model's, or the recipe's author's
 * — and a strict limit threw dishes away for running a minute or two over it:
 * across a week's benchmark, time was a routine reason to drop a dish, and a
 * real generation lost its only model dinner to it. The owner's rule: 30
 * admits 40, 55 admits 70 (55 × 1.2 = 66), 25 admits 30. Integer arithmetic,
 * so an exact multiple of ten stays where it is. The prompt still asks for the
 * limit itself; this margin is only for accepting what comes back.
 */
export function timeAllowance(limit: number): number {
  return Math.ceil((limit * 12) / 100) * 10;
}

/** Whether a dish can be cooked in the time they said they have, give or take the margin `timeAllowance` allows. */
export function withinTime(dish: { readonly cookMinutes: number; readonly prepMinutes: number }, limit: number | null): boolean {
  return limit === null || dish.prepMinutes + dish.cookMinutes <= timeAllowance(limit);
}
