import type { CandidateDish, Catalogue, Macros } from 'core/entities/Plan';

const PER_100G = 100;

export type CompositionResult = { readonly macros: Macros; readonly ok: true } | { readonly ok: false; readonly unknownSlugs: readonly string[] };

/**
 * Sums a dish's macros from the catalogue.
 *
 * This is the only place a calorie figure is ever produced, and it produces it by
 * arithmetic over composition-table values —
 * see [`0004`](../../../../../docs/decisions/0004-deterministic-safety-layer.md).
 *
 * Returns a result rather than throwing, because an unknown slug is an expected
 * outcome on the generation path (the model proposed something outside the
 * catalogue) and the caller needs the list to build a retry.
 */
export function composeMacros(ingredients: readonly { grams: number; slug: string }[], catalogue: Catalogue): CompositionResult {
  const unknownSlugs = ingredients.map(item => item.slug).filter(slug => !catalogue.has(slug));

  if (unknownSlugs.length > 0) {
    return { ok: false, unknownSlugs: [...new Set(unknownSlugs)] };
  }

  const macros = ingredients.reduce<Macros>(
    (total, item) => {
      // Non-null: every slug was just confirmed present.
      const ingredient = catalogue.get(item.slug) as NonNullable<ReturnType<Catalogue['get']>>;
      const factor = item.grams / PER_100G;

      return {
        carbsG: total.carbsG + ingredient.carbsPer100g * factor,
        fatG: total.fatG + ingredient.fatPer100g * factor,
        fiberG: total.fiberG + ingredient.fiberPer100g * factor,
        kcal: total.kcal + ingredient.kcalPer100g * factor,
        proteinG: total.proteinG + ingredient.proteinPer100g * factor
      };
    },
    { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
  );

  return { macros: round(macros), ok: true };
}

/** Per-serving macros for a dish whose quantities are stated for `dish.servings`. */
export function composePerServing(dish: CandidateDish, catalogue: Catalogue): CompositionResult {
  const composed = composeMacros(dish.ingredients, catalogue);

  if (!composed.ok) {
    return composed;
  }

  return { macros: scaleMacros(composed.macros, 1 / dish.servings), ok: true };
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return round({
    carbsG: macros.carbsG * factor,
    fatG: macros.fatG * factor,
    fiberG: macros.fiberG * factor,
    kcal: macros.kcal * factor,
    proteinG: macros.proteinG * factor
  });
}

export function scaleIngredients(
  ingredients: readonly { grams: number; slug: string }[],
  factor: number
): readonly { grams: number; slug: string }[] {
  return ingredients.map(item => ({ grams: roundTo(item.grams * factor, 1), slug: item.slug }));
}

export function addMacros(a: Macros, b: Macros): Macros {
  return round({
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
    fiberG: a.fiberG + b.fiberG,
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG
  });
}

export const ZERO_MACROS: Macros = { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 };

export function sumMacros(all: readonly Macros[]): Macros {
  return all.reduce(addMacros, ZERO_MACROS);
}

/**
 * One decimal throughout. The database columns are `numeric(7,2)`, and carrying
 * float noise into a stored total makes the reconciliation test in phase 7
 * unwritable.
 */
function round(macros: Macros): Macros {
  return {
    carbsG: roundTo(macros.carbsG, 1),
    fatG: roundTo(macros.fatG, 1),
    fiberG: roundTo(macros.fiberG, 1),
    kcal: roundTo(macros.kcal, 1),
    proteinG: roundTo(macros.proteinG, 1)
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
