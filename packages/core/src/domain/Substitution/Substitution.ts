import { isSafe } from 'core/domain/Safety';

import type { IngredientAllergenLink } from 'core/domain/Safety';
import type { SafetyProfile } from 'core/entities/Safety';

/** Per 100 g, as the catalogue stores them. */
export type Macros = { readonly carbsPer100g: number; readonly fatPer100g: number; readonly kcalPer100g: number; readonly proteinPer100g: number };

export type SubstituteCandidate = Macros & {
  readonly id: string;
  readonly allergens: readonly IngredientAllergenLink[];
  readonly name: string;
  /** Grams of substitute per gram of the original. */
  readonly ratio: number;
};

export type Alternative = { readonly grams: number; readonly name: string };

/** Enough to be a real choice, few enough to read at a glance in a shop. */
export const ALTERNATIVES_SHOWN = 3;

/**
 * The alternatives one person may be shown for one ingredient of one meal.
 *
 * Every candidate is a catalogue row, so it carries its own allergen links, and
 * the same `isSafe` that gated the dish gates the swap — an alternative the
 * person is allergic to is not shown with a warning, it is not shown. Allergies
 * are hard constraints ([`0004`](../../../../docs/decisions/0004-ai-provider-and-deterministic-safety.md)),
 * and a substitute is exactly the place a prompt-only rule would leak.
 *
 * Ordered by how close the substitute's macros are to the original's, so the
 * first suggestion is the one that changes the day's numbers least. The table
 * carries no rank of its own; nutritional distance is deterministic and it is
 * the right order anyway.
 */
export function alternativesFor(
  original: Macros,
  grams: number,
  candidates: readonly SubstituteCandidate[],
  profile: SafetyProfile,
  limit = ALTERNATIVES_SHOWN
): readonly Alternative[] {
  return candidates
    .filter(candidate => isSafe([{ id: candidate.id, allergens: candidate.allergens, name: candidate.name }], profile))
    .map(candidate => ({ candidate, distance: macroDistance(original, candidate) }))
    .sort((a, b) => a.distance - b.distance || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map(({ candidate }) => ({ grams: Math.round(grams * candidate.ratio), name: candidate.name }));
}

/**
 * Each macro's difference, in units of what a meaningful gap is for it: 50 kcal,
 * 5 g of protein or fat, 10 g of carbohydrate. Rough by design — it orders, it
 * does not judge.
 */
function macroDistance(a: Macros, b: Macros): number {
  return (
    Math.abs(a.kcalPer100g - b.kcalPer100g) / 50 +
    Math.abs(a.proteinPer100g - b.proteinPer100g) / 5 +
    Math.abs(a.carbsPer100g - b.carbsPer100g) / 10 +
    Math.abs(a.fatPer100g - b.fatPer100g) / 5
  );
}
