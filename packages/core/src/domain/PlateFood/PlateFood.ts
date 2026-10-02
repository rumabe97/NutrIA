import { isLegumeSlug } from 'core/domain/Preference';
import { toDry } from 'core/domain/Yield';
import type { Catalogue, CatalogueIngredient, MealSlot } from 'core/entities/Plan';

/** The foods a plate is capped by (`0008` § D) — the ones a plate fills up with when it is sized past two servings. */
export type PlateFood = 'fish' | 'grain' | 'legume' | 'meat' | 'potato';

/**
 * How much of one food a plate may carry, in grams (`0008` § D, 016 PRD
 * criterion 3): about two servings. Grain is weighed dry, by `0078`'s yields;
 * every other food as it is served.
 *
 * `PLATE_GRAMS_MAX` caps the plate; this caps what it is made of. A 750-g
 * plate may still be 450 g of potato, and nobody serves that. Enforced where
 * the plate's weight is (`withinPlateLimit`), with the same one exception: the
 * energy floor.
 */
export const PLATE_FOOD_MAX: Readonly<Record<PlateFood, number>> = { fish: 300, grain: 160, legume: 400, meat: 250, potato: 400 };

/**
 * A meal whose share of the day is past this many kcal is a person of `0070`,
 * who needs 2–4 servings: their ceilings grow by share ÷ `fromKcal`. Only the
 * meals — a snack or a supper never gets there.
 */
export const PLATE_FOOD_SCALE = { fromKcal: 1100 } as const;

const SCALED_SLOTS: ReadonlySet<MealSlot> = new Set(['breakfast', 'lunch', 'dinner']);

/** Potato and sweet potato, as the catalogue names them. A list, not a prefix, so nothing new joins without being read. */
const POTATO_SLUGS: ReadonlySet<string> = new Set([
  'boniato',
  'patata',
  'patata-nueva',
  'patatas-fritas-congeladas',
  'patatas-fritas-de-bolsa',
  'patatas-gajo-congeladas'
]);

/**
 * Which capped food `grams` of this ingredient is, and how much of it counts:
 * a cooked grain counts dry. Null for anything uncapped, or a slug the
 * catalogue does not know.
 */
export function plateFood(
  slug: string,
  grams: number,
  ingredient: CatalogueIngredient | undefined
): { readonly food: PlateFood; readonly grams: number } | null {
  const dry = toDry(slug, grams);

  if (dry) {
    return { food: 'grain', grams: dry.dryGrams };
  }

  if (isLegumeSlug(slug)) {
    return { food: 'legume', grams };
  }

  if (POTATO_SLUGS.has(slug)) {
    return { food: 'potato', grams };
  }

  const classes = ingredient?.classes ?? [];

  if (classes.includes('meat') || classes.includes('pork')) {
    return { food: 'meat', grams };
  }

  if (classes.includes('fish') || classes.includes('shellfish')) {
    return { food: 'fish', grams };
  }

  return null;
}

/** Grams of each capped food in these ingredients, summed per food. Foods it holds none of are absent. */
export function plateFoods(
  ingredients: readonly { readonly grams: number; readonly slug: string }[],
  catalogue: Catalogue
): Readonly<Partial<Record<PlateFood, number>>> {
  const foods: Partial<Record<PlateFood, number>> = {};

  for (const item of ingredients) {
    const counted = plateFood(item.slug, item.grams, catalogue.get(item.slug));

    if (counted) {
      foods[counted.food] = (foods[counted.food] ?? 0) + counted.grams;
    }
  }

  return foods;
}

/** The most of `food` one plate in this slot may carry when its share of the day is `budgetKcal`. */
export function plateFoodMax(food: PlateFood, slot: MealSlot, budgetKcal: number): number {
  const base = PLATE_FOOD_MAX[food];

  return SCALED_SLOTS.has(slot) && budgetKcal > PLATE_FOOD_SCALE.fromKcal ? (base * budgetKcal) / PLATE_FOOD_SCALE.fromKcal : base;
}
